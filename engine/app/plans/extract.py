"""Read CAD/vector evidence directly; use OpenCV only for raster content.

An extracted line is not a wall. Confidence describes extraction, not semantic
certainty. All points use the preview's normalized top-left coordinate frame.
"""

import base64
import io
import math
import threading
from itertools import pairwise
from pathlib import Path

import cv2
import ezdxf
import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from ezdxf import disassemble, units
from ezdxf.path import make_path
from PIL import Image, ImageDraw, ImageOps

from app.plan_schemas import (
    MAX_PLAN_LINES,
    MAX_PLAN_TEXTS,
    PlanEvidence,
    PlanLine,
    PlanPoint,
    PlanSource,
    PlanText,
)

MAX_LINES = MAX_PLAN_LINES
MAX_TEXTS = MAX_PLAN_TEXTS
MAX_CAD_ENTITIES = 200_000
MAX_TEXT_CHARACTERS = 2_000_000
MAX_PIXELS = 30_000_000
# PDFium explicitly disallows simultaneous calls even for different documents.
_PDF_LOCK = threading.Lock()


class PlanInputError(ValueError):
    pass


class PlanResourceError(PlanInputError):
    """The full extraction cannot fit; never return a silently truncated plan."""


def check_evidence_budget(line_count=0, text_count=0, text_characters=0):
    if line_count > MAX_LINES:
        raise PlanResourceError(
            f"Drawing exceeds the {MAX_LINES:,}-line extraction resource limit. "
            "No partial evidence was returned. Export a smaller region or simplify the drawing."
        )
    if text_count > MAX_TEXTS or text_characters > MAX_TEXT_CHARACTERS:
        raise PlanResourceError(
            "Drawing text exceeds the extraction resource limit. No partial evidence was "
            "returned. Export a smaller region."
        )


def clip_segment(x0, y0, x1, y1, bounds):
    """Clip a segment parametrically; preserve diagonal intersections at page edges."""
    left, top, right, bottom = bounds
    dx, dy = x1 - x0, y1 - y0
    enter, leave = 0.0, 1.0
    for direction, distance in (
        (-dx, x0 - left),
        (dx, right - x0),
        (-dy, y0 - top),
        (dy, bottom - y0),
    ):
        if direction == 0:
            if distance < 0:
                return None
            continue
        ratio = distance / direction
        if direction < 0:
            enter = max(enter, ratio)
        else:
            leave = min(leave, ratio)
        if enter > leave:
            return None
    return x0 + enter * dx, y0 + enter * dy, x0 + leave * dx, y0 + leave * dy


def point(x, y):
    return PlanPoint(x=max(0, min(1, float(x))), y=max(0, min(1, float(y))))


def line(a, b, origin, index, confidence=1.0, kind="unknown"):
    return PlanLine(
        id=f"{origin}-{index}", a=a, b=b, origin=origin, confidence=confidence, kind=kind
    )


def preview_url(image):
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def raster_lines(image):
    gray = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    height, width = gray.shape
    candidates = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=30,
        minLineLength=max(12, min(width, height) // 60),
        maxLineGap=4,
    )
    if candidates is None:
        return []
    # Keep every detected segment, ordered longest first for consistent review.
    check_evidence_budget(line_count=len(candidates))
    candidates = sorted(
        candidates.reshape(-1, 4), key=lambda p: -math.hypot(p[2] - p[0], p[3] - p[1])
    )
    return [
        line(point(x1 / width, y1 / height), point(x2 / width, y2 / height), "raster", i, 0.5)
        for i, (x1, y1, x2, y2) in enumerate(candidates)
    ]


def result(
    name, fmt, image, lines, texts, warnings, method, page=1, pages=1, width_m=None, height_m=None
):
    check_evidence_budget(len(lines), len(texts), sum(len(text.text) for text in texts))
    if not lines:
        warnings.append(
            "No usable line evidence found. Trace geometry manually or try another page."
        )
    warnings.append(
        "Line candidates are not confirmed walls. Review geometry before creating a scene."
    )
    if width_m is None:
        warnings.append("Actual dimensions are unknown. Calibrate against a known distance.")
    return PlanEvidence(
        source=PlanSource(
            name=name, format=fmt, page=page, pages=pages, width=image.width, height=image.height
        ),
        preview=preview_url(image),
        lines=lines,
        texts=texts,
        warnings=warnings,
        method=method,
        widthMeters=width_m,
        heightMeters=height_m,
    )


def read_image(data, name, page):
    if page != 1:
        raise PlanInputError("Images contain one page; select page 1.")
    with Image.open(io.BytesIO(data)) as original:
        if original.format not in {"PNG", "JPEG"}:
            raise PlanInputError("Only PNG and JPEG images are supported.")
        if original.width * original.height > MAX_PIXELS:
            raise PlanInputError("Image exceeds the 30 megapixel limit.")
        image = ImageOps.exif_transpose(original).convert("RGB")
    image.thumbnail((1800, 1800))
    return result(
        name,
        "image",
        image,
        raster_lines(image),
        [],
        [
            "Raster line detection only. Text, door symbols and dimensions need Muse or review; "
            "OCR has not been performed."
        ],
        "opencv",
    )


def read_pdf(data, name, page):
    with _PDF_LOCK:
        with pdfium.PdfDocument(data) as document:
            if not 1 <= page <= len(document):
                raise PlanInputError(f"Select a page between 1 and {len(document)}.")
            pdf_page = document[page - 1]
            # Render full MediaBox to match pdfplumber, including rotated pages.
            pdf_page.set_cropbox(*pdf_page.get_mediabox())
            w, h = pdf_page.get_size()
            if w <= 0 or h <= 0:
                raise PlanInputError("PDF page has invalid dimensions.")
            bitmap = pdf_page.render(scale=min(2, 1800 / max(w, h)))
            image = bitmap.to_pil().convert("RGB")
            bitmap.close()
            pdf_page.close()
        with pdfplumber.open(io.BytesIO(data)) as document:
            p = document.pages[page - 1]
            w, h = p.width, p.height
            ox, oy = p.bbox[:2]
            # PDF content streams may retain objects beyond a cropped MediaBox.
            # Ignore hidden views before normalization instead of clamping them
            # onto the visible page border. Preserve crop metadata for warnings.
            visible = p.crop(p.bbox)
            lines = []
            # .edges includes line objects, rectangle edges and curve segments.
            for edge in visible.edges:
                x0, x1 = edge["x0"], edge["x1"]
                top, bottom = edge["top"], edge["bottom"]
                # For actual lines preserve the endpoint direction (diagonal sign).
                pts = edge.get("pts")
                if pts and len(pts) == 2:
                    (x0, top), (x1, bottom) = pts
                clipped = clip_segment(x0, top, x1, bottom, p.bbox)
                if clipped is None:
                    continue
                x0, top, x1, bottom = clipped
                if math.hypot(x1 - x0, bottom - top) <= 1e-9:
                    continue
                lines.append(
                    line(
                        point((x0 - ox) / w, (top - oy) / h),
                        point((x1 - ox) / w, (bottom - oy) / h),
                        "vector",
                        len(lines),
                    )
                )
                check_evidence_budget(line_count=len(lines))
            words = visible.extract_words()
            check_evidence_budget(
                text_count=len(words), text_characters=sum(len(word["text"]) for word in words)
            )
            texts = [
                PlanText(
                    id=f"text-{i}",
                    text=word["text"],
                    x=point((word["x0"] - ox) / w, (word["top"] - oy) / h).x,
                    y=point((word["x0"] - ox) / w, (word["top"] - oy) / h).y,
                )
                for i, word in enumerate(words)
            ]
            warnings = []
            if p.cropbox and tuple(p.cropbox) != tuple(p.mediabox):
                warnings.append(
                    "Full PDF media page shown, including content outside its crop box."
                )
            method = "pdf-vector"
            if not lines:
                lines = raster_lines(image)
                method = "opencv"
                warnings.append(
                    "No vector lines found; raster detection was used. "
                    "Raster text has not been OCR-processed."
                )
            elif p.images:
                warnings.append(
                    "This page includes embedded images. Vector evidence may not "
                    "cover image-only drawing regions; review the preview."
                )
                # Retain vector precision; offer additional observations from raster content.
                lines.extend(raster_lines(image))
            return result(
                name,
                "pdf",
                image,
                lines,
                texts,
                warnings,
                method,
                page=page,
                pages=len(document.pages),
            )


def read_dxf(data, name, page):
    if page != 1:
        raise PlanInputError("DXF model space has one preview; select page 1.")
    if data.startswith(b"AutoCAD Binary DXF"):
        raise PlanInputError("Binary DXF is not supported yet. Export an ASCII DXF.")
    # Surrogate escapes retain bytes used by legacy DXF code pages for the reader.
    document = ezdxf.read(io.StringIO(data.decode("utf-8-sig", errors="surrogateescape")))
    segments, labels = [], []
    skipped = set()
    count = 0
    for entity in disassemble.recursive_decompose(document.modelspace()):
        count += 1
        if count > MAX_CAD_ENTITIES:
            raise PlanResourceError(
                f"DXF exceeds the {MAX_CAD_ENTITIES:,}-entity resource limit. "
                "No partial evidence was returned. Export a smaller model-space region."
            )
        kind = entity.dxftype()
        if kind in {"TEXT", "MTEXT"}:
            pos = entity.dxf.insert
            text = entity.plain_text() if kind == "MTEXT" else entity.dxf.text
            labels.append((str(text), pos.x, pos.y))
            check_evidence_budget(text_count=len(labels))
            continue
        try:
            vertices = make_path(entity).flattening(distance=0.1, segments=8)
        except (TypeError, ValueError, AttributeError):
            skipped.add(kind)
            continue
        for a, b in pairwise(vertices):
            if all(math.isfinite(v) for v in (a.x, a.y, b.x, b.y)):
                segments.append((a.x, a.y, b.x, b.y))
                check_evidence_budget(line_count=len(segments))
    if not segments:
        raise PlanInputError("No supported model-space geometry in this DXF.")
    xs = [v for segment in segments for v in (segment[0], segment[2])]
    ys = [v for segment in segments for v in (segment[1], segment[3])]
    xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    pad = max(xmax - xmin, ymax - ymin, 1) * 0.02
    xmin, ymin = xmin - pad, ymin - pad
    w, h = xmax - xmin + pad, ymax - ymin + pad
    width, height = max(1, round(1600 * w / max(w, h))), max(1, round(1600 * h / max(w, h)))
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    lines = []
    for i, (x1, y1, x2, y2) in enumerate(segments):
        a, b = (
            point((x1 - xmin) / w, 1 - (y1 - ymin) / h),
            point((x2 - xmin) / w, 1 - (y2 - ymin) / h),
        )
        lines.append(line(a, b, "cad", i))
        draw.line((a.x * width, a.y * height, b.x * width, b.y * height), fill="#444444", width=1)
    texts = []
    for i, (value, x, y) in enumerate(labels):
        pos = point((x - xmin) / w, 1 - (y - ymin) / h)
        texts.append(PlanText(id=f"text-{i}", text=value, x=pos.x, y=pos.y))
        draw.text((pos.x * width, pos.y * height), value, fill="#555555")
    width_m = height_m = None
    warnings = [
        "DXF model-space preview; curves are approximated as segments. "
        "Layers and dimension relationships are not yet interpreted."
    ]
    if document.units:
        try:
            factor = units.conversion_factor(document.units, units.M)
            width_m, height_m = w * factor, h * factor
            if max(width_m, height_m) > 10000:
                width_m = height_m = None
                warnings.append("Declared units imply a viewport over 10 km; calibrate manually.")
            warnings.append(
                "Dimensions use declared DXF units and include preview margins. "
                "Confirm units and select the usable space before designing."
            )
        except (ValueError, TypeError):
            warnings.append("Unsupported DXF unit declaration; calibration required.")
    if skipped:
        warnings.append("Unsupported entity types omitted: " + ", ".join(sorted(skipped)))
    return result(
        name, "dxf", image, lines, texts, warnings, "dxf", width_m=width_m, height_m=height_m
    )


def extract_plan(data: bytes, filename: str, page: int = 1) -> PlanEvidence:
    name = Path(filename).name[:200]
    suffix = Path(name).suffix.lower()
    if not data:
        raise PlanInputError("The uploaded file is empty.")
    if len(data) > 20 * 1024 * 1024:
        raise PlanInputError("Upload a file no larger than 20 MB.")
    if page < 1:
        raise PlanInputError("Page numbers start at 1.")
    try:
        if suffix == ".pdf" and data.startswith(b"%PDF-"):
            return read_pdf(data, name, page)
        if suffix in {".png", ".jpg", ".jpeg"}:
            return read_image(data, name, page)
        if suffix == ".dxf":
            return read_dxf(data, name, page)
        raise PlanInputError("Upload a valid PDF, PNG, JPEG or ASCII DXF file.")
    except PlanInputError:
        raise
    except Exception as error:
        # Parser diagnostics can include source contents. Return only a safe error class.
        raise PlanInputError(
            f"Could not read this drawing ({type(error).__name__}). "
            "Check the format, password protection and file integrity."
        ) from error
