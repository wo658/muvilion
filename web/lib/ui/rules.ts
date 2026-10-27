/** Human-readable labels for validation rule ids (engine rules.py + agent-side checks). */
export const RULE_LABEL: Record<string, string> = {
  aisle_width: "Aisle too narrow",
  booth_outside_hall: "Outside the site",
  booth_over_obstacle: "Over an obstacle",
  booth_overlap: "Booths overlap",
  booth_unreachable: "Booth unreachable",
  connectivity: "Walkable area split",
  door_clearance: "Door clearance blocked",
  door_unreachable: "Door unreachable",
  entrance_blocked: "Entrance blocked",
  fire_lane_blocked: "Fire lane blocked",
  keep_out: "In a keep-out area",
  wall_margin: "Too close to wall / fence",
  zone_unbuildable: "On an unbuildable zone",
  layout_infeasible: "Solver: infeasible",
  booth_missing: "Booth not placed",
  popular_door_distance: "Popular booth near entrance",
};

export const ruleLabel = (id: string) => RULE_LABEL[id] ?? id.replace(/_/g, " ");
