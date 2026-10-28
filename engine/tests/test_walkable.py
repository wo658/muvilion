from shapely.geometry import Point

from app.geometry import booth_polygon, obstacle_polygon
from app.schemas import Layout, Venue
from app.walkable import build_walkable


def test_walkable_excludes_booths_and_obstacles(sample, solved_layout):
    venue = Venue.model_validate(sample["venue"])
    layout = Layout.model_validate(solved_layout["layout"])
    walkable = build_walkable(venue, layout)
    assert not walkable.is_empty
    for booth in layout.booths:
        assert walkable.intersection(booth_polygon(booth)).area < 1e-9
    for obstacle in venue.obstacles:
        assert walkable.intersection(obstacle_polygon(obstacle)).area < 1e-9


def test_walkable_keeps_entrance_component_when_floor_is_split():
    venue = Venue.model_validate(
        {
            "id": "split",
            "name": "Split hall",
            "width": 20,
            "height": 10,
            "doors": [
                {"id": "entry", "kind": "entrance", "a": {"x": 1, "y": 0}, "b": {"x": 3, "y": 0}}
            ],
            "obstacles": [
                {
                    "id": "wall",
                    "kind": "structure",
                    "polygon": [
                        {"x": 5, "y": 0},
                        {"x": 6, "y": 0},
                        {"x": 6, "y": 10},
                        {"x": 5, "y": 10},
                    ],
                }
            ],
        }
    )
    walkable = build_walkable(venue, Layout(id="empty", venue_id="split", booths=[]))
    assert walkable.contains(Point(2, 5))
    assert not walkable.contains(Point(12, 5))
