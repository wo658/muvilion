"""Create a vector-only ground-floor sheet from the official combined drawing.

From engine/: uv run --with pypdf python -m scripts.prepare_fort_mason SOURCE.pdf OUTPUT.pdf
The optional pypdf dependency is needed only for this preparation utility.
Crop uses top-left PDF points on source page 1. Original pattern resources are
preserved; consumers must clip extracted evidence to the visible MediaBox.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject

SOURCE_URL = "https://fortmason.org/wp-content/uploads/2025/12/Festival-Pavilion-Dimensions.pdf"
CROP = (390.0, 140.0, 665.0, 1165.0)
# Endpoints are from blue dimension LINE entities, in cropped top-left PDF points.
DIMENSIONS = [
    ("104'-1\"", 31.7246, ((74.5015074, 300.2758052), (224.3698266, 300.2758052))),
    ("481'-0\"", 146.6088, ((182.6895812, 87.7366477), (182.6895812, 780.4262134))),
    ("575'-0\"", 175.26, ((150.0375478, 84.7272437), (150.0375478, 912.6895192))),
]
INNER_ENVELOPE = [
    (68.0312888, 87.8118828),
    (230.4638697, 87.8118828),
    (230.4638697, 912.6142841),
    (68.0312888, 912.6142841),
]


def prepare(source: Path, output: Path):
    left, top, right, bottom = CROP
    width, height = right - left, bottom - top
    original = PdfReader(source)
    page = original.pages[0]
    source_height = float(page.mediabox.height)
    page.add_transformation(Transformation().translate(-left, -(source_height - bottom)))
    for box in ("mediabox", "cropbox", "trimbox", "artbox", "bleedbox"):
        setattr(page, box, RectangleObject([0, 0, width, height]))
    writer = PdfWriter()
    writer.add_page(page)
    writer.write(output)
    # Verify the serialized file, not PDFium's in-memory page object.
    with pdfium.PdfDocument(output) as reopened:
        preview = reopened[0].render(scale=3)
        preview.to_pil().save(output.with_suffix(".png"))
        preview.close()
    with pdfplumber.open(output) as doc:
        p = doc.pages[0].crop(doc.pages[0].bbox)
        text = p.extract_text() or ""
        assert "GROUND FLOOR PLAN" in text
        assert "ELEVATION SOUTH" not in text and "SECOND FLOOR" not in text
        assert not p.images, "Ground-floor crop should preserve vectors, not rasterize"
        edges, words = len(p.edges), len(p.extract_words())

    def normalized(pt):
        return {"x": pt[0] / width, "y": pt[1] / height}

    references = [
        {
            "label": label,
            "meters": meters,
            "cropPoints": [list(a), list(b)],
            "a": normalized(a),
            "b": normalized(b),
            "metersPerPdfPoint": meters / math.dist(a, b),
            "evidence": "Blue dimension line endpoints and adjacent dimension label; manual review",
        }
        for label, meters, (a, b) in DIMENSIONS
    ]
    factor = references[0]["metersPerPdfPoint"]
    metadata = {
        "source": SOURCE_URL,
        "retrievedDate": "2026-10-28",
        "sourceFile": source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "file": output.name,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "sourcePage": 1,
        "sourceMediaBoxPoints": [0, 0, 792, 1224],
        "cropTopLeftPoints": list(CROP),
        "outputSizePoints": [width, height],
        "coordinateTransform": {"sourceTopLeftToCrop": {"subtractX": left, "subtractY": top}},
        "method": "Translate original content stream with pattern resources intact; clip via "
        "MediaBox/CropBox. Extraction clips evidence to visible page. No rasterization.",
        "edges": edges,
        "words": words,
        "dimensionReferences": references,
        "recommendedCalibration": {
            "referenceIndex": 0,
            "viewportWidthMeters": width * factor,
            "viewportHeightMeters": height * factor,
            "note": "Viewport includes margins and pier exterior; this is not hall size. "
            "Independent vertical references agree with primary scale within 0.015%.",
        },
        "reviewedInteriorEnvelope": {
            "label": "Simplified interior building envelope, including service-room floors",
            "cropPoints": [list(pt) for pt in INNER_ENVELOPE],
            "polygon": [normalized(pt) for pt in INNER_ENVELOPE],
            "status": "manual-review-inference",
            "note": "Traced from north/west/east/south inner wall lines; excludes pier outline. "
            "Sidewall ribs and service blocks require collision walls. "
            "This is a floor envelope, not a certified free-space boundary.",
            "walkStart": normalized((150.0, 500.0)),
        },
        "entranceCandidate": {
            "label": "One door pair in south facade exit bank",
            "a": normalized((156.6176, 913.4419)),
            "b": normalized((164.7776, 913.4419)),
            "status": "visual-door-candidate",
            "note": "Door symbols visible; not verified as the event's main entrance. "
            "Do not automatically clear unrelated walls.",
        },
        "heightReferences": {
            "sourceView": "Original sheet elevation south/north (outside ground-floor crop)",
            "localClearancesMeters": [6.0198, 6.8199, 6.8326],
            "labels": ["19'-9\"", "22'-4 1/2\"", "22'-5\""],
            "uniformHeightConfirmed": False,
            "note": "Roof/truss underside varies across the width. These are local elevation "
            "clearances, not a uniform wall or ceiling height.",
        },
        "purpose": "Local floor-plan recognition, metric calibration and walkthrough evaluation",
        "license": "Publicly downloadable source; redistribution rights not verified.",
    }
    output.with_suffix(".source.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    prepare(args.source, args.output)
