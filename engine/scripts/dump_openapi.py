"""Print the engine's OpenAPI spec as JSON (no server needed).

Run from engine/: uv run python -m scripts.dump_openapi
"""

import json

from app.main import app

print(json.dumps(app.openapi(), indent=2))
