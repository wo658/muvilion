import base64
import io

import ezdxf
import pytest
from PIL import Image, ImageDraw

from app.plans.extract import PlanInputError, extract_plan


def vector_pdf(page_options=b""):
    """Small real PDF with a rectangle, diagonal line and selectable text."""
    stream = b"2 w 20 20 160 60 re S 20 20 m 180 80 l S BT /F1 12 Tf 30 50 Td (Hall 1) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R " + page_options + b" >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    data = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    xref = len(data)
    data += b"xref\n0 6\n0000000000 65535 f \n"
    for offset in offsets[1:]:
        data += f"{offset:010d} 00000 n \n".encode()
    data += f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return data


def raster(fmt="PNG"):
    image = Image.new("RGB", (400, 300), "white")
    ImageDraw.Draw(image).rectangle((40, 40, 360, 260), outline="black", width=5)
    out = io.BytesIO()
    image.save(out, format=fmt)
    return out.getvalue()


def dxf(unit=4):
    doc = ezdxf.new()
    doc.units = unit
    doc.modelspace().add_lwpolyline([(0, 0), (10000, 0), (10000, 5000), (0, 5000)], close=True)
    doc.modelspace().add_text("Hall", dxfattribs={"insert": (1000, 1000), "height": 100})
    out = io.StringIO()
    doc.write(out)
    return out.getvalue().encode()


def test_vector_pdf_preserves_geometry_and_text():
    plan = extract_plan(vector_pdf(), "hall.pdf")
    assert plan.method == "pdf-vector"
    assert len(plan.lines) == 5
    assert "Hall" in [t.text for t in plan.texts]
    assert plan.widthMeters is None
    assert not plan.scaleConfirmed
    diagonal = [v for v in plan.lines if v.a.x != v.b.x and v.a.y != v.b.y][0]
    assert diagonal.a.x == pytest.approx(0.1)
    assert diagonal.a.y == pytest.approx(0.8)
    assert diagonal.b.y == pytest.approx(0.2)
    png = base64.b64decode(plan.preview.split(",", 1)[1])
    assert png.startswith(b"\x89PNG")


def test_raster_candidates_are_not_confirmed_walls():
    plan = extract_plan(raster(), "hall.png")
    assert plan.method == "opencv"
    assert len(plan.lines) >= 4
    assert all(v.kind == "unknown" and v.origin == "raster" for v in plan.lines)
    assert any("OCR" in warning for warning in plan.warnings)
    assert plan.widthMeters is None


def test_scanned_pdf_falls_back_to_opencv():
    out = io.BytesIO()
    Image.open(io.BytesIO(raster())).save(out, format="PDF")
    plan = extract_plan(out.getvalue(), "scan.pdf")
    assert plan.method == "opencv"
    assert len(plan.lines) >= 4
    assert plan.source.pages == 1


def test_dxf_units_are_preserved_but_not_confirmed():
    plan = extract_plan(dxf(), "hall.dxf")
    assert plan.method == "dxf"
    assert len(plan.lines) == 4
    assert plan.widthMeters == pytest.approx(10.4)
    assert plan.heightMeters == pytest.approx(5.4)
    assert plan.scaleConfirmed is False
    assert plan.texts[0].text == "Hall"
    assert plan.lines[0].a.y > plan.lines[2].a.y
    assert extract_plan(dxf(unit=0), "unitless.dxf").widthMeters is None


@pytest.mark.parametrize(
    "data,name,page",
    [
        (b"bad", "hall.pdf", 1),
        (b"", "hall.png", 1),
        (b"not a dxf", "hall.dxf", 1),
        (vector_pdf(), "hall.pdf", 2),
        (raster(), "hall.png", 2),
        (raster(), "hall.png", 0),
        (b"text", "hall.txt", 1),
    ],
)
def test_invalid_inputs(data, name, page):
    with pytest.raises(PlanInputError):
        extract_plan(data, name, page)


def test_blank_image_is_honest():
    out = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(out, format="PNG")
    plan = extract_plan(out.getvalue(), "blank.png")
    assert not plan.lines
    assert any("No usable line" in warning for warning in plan.warnings)


def test_upload_endpoint(client):
    response = client.post(
        "/plans/extract", files={"file": ("hall.pdf", vector_pdf())}, data={"page": 1}
    )
    assert response.status_code == 200
    assert response.json()["schemaVersion"] == 1
    response = client.post(
        "/plans/extract", files={"file": ("hall.png", raster())}, data={"page": 2}
    )
    assert response.status_code == 422


def test_upload_limit(client):
    response = client.post(
        "/plans/extract", files={"file": ("large.pdf", b"a" * (20 * 1024 * 1024 + 1))}
    )
    assert response.status_code == 413


@pytest.mark.parametrize(
    "options", [b"/Rotate 90", b"/CropBox [10 10 190 90]", b"/Rotate 270 /CropBox [10 10 190 90]"]
)
def test_rotated_cropped_pdf_evidence_matches_preview(options):
    plan = extract_plan(vector_pdf(options), "rotated.pdf")
    preview = Image.open(io.BytesIO(base64.b64decode(plan.preview.split(",", 1)[1])))
    for segment in plan.lines:
        x = round((segment.a.x + segment.b.x) / 2 * preview.width)
        y = round((segment.a.y + segment.b.y) / 2 * preview.height)
        pixels = preview.crop(
            (max(0, x - 3), max(0, y - 3), min(preview.width, x + 4), min(preview.height, y + 4))
        )
        assert pixels.convert("L").getextrema()[0] < 100
    if b"CropBox" in options:
        assert any("crop box" in warning for warning in plan.warnings)
