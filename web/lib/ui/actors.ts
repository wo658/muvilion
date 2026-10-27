/**
 * Who does what in the pipeline. One table drives the pipeline panel, the "How it works"
 * explainer and the README role table (keep them in sync).
 */
import type { StepName } from "@/lib/agent/events";

export type ActorId = "muse" | "ortools" | "shapely" | "jupedsim" | "simpy" | "code";

export type Actor = { id: ActorId; tag: string; name: string; role: string; llm?: boolean };

export const ACTORS: Record<ActorId, Actor> = {
  muse: {
    id: "muse",
    tag: "Muse",
    name: "Muse (Meta Model API)",
    llm: true,
    role: "Reads the site and writes the design brief; interprets simulation results; decides revisions; writes the report.",
  },
  ortools: {
    id: "ortools",
    tag: "OR-Tools",
    name: "OR-Tools CP-SAT",
    role: "Computes booth coordinates that satisfy the constraints (no overlap, aisle widths, door clearance, keep-outs) and minimises displacement on revisions.",
  },
  shapely: {
    id: "shapely",
    tag: "Shapely",
    name: "Shapely",
    role: "Geometry checks: overlap, outside the site, obstacle and zone conflicts, aisle width, reachability of every booth and door, fire-lane continuity.",
  },
  jupedsim: {
    id: "jupedsim",
    tag: "JuPedSim",
    name: "JuPedSim",
    role: "Pedestrian simulation: agents walk, queue and dwell; outputs density, travel time, completion and trajectories.",
  },
  simpy: {
    id: "simpy",
    tag: "SimPy",
    name: "SimPy",
    role: "Queue model for ticket and registration desks. Available in the engine (POST /queue) but not called by this loop yet.",
  },
  code: {
    id: "code",
    tag: "Code",
    name: "Code (ours)",
    role: "Fixes the scenario so before/after are compared under identical conditions; turns intent into constraints; aggregates metrics; renders the views.",
  },
};

export const ACTOR_ORDER: ActorId[] = ["muse", "ortools", "shapely", "jupedsim", "simpy", "code"];

/** Actors behind a loop step (primary first). */
export const STEP_ACTORS: Record<StepName, ActorId[]> = {
  brief: ["muse", "code"],
  generate: ["ortools"],
  validate: ["shapely", "code"],
  simulate: ["jupedsim"],
  compare: ["code"],
  analyze: ["muse"],
  revise: ["muse", "code"],
  report: ["muse", "code"],
};

/** One-line description of what happens in a step, shown under its title. */
export const STEP_ROLE: Record<StepName, string> = {
  brief: "Muse states intent for the empty site; code derives the first constraints.",
  generate: "CP-SAT solves for booth coordinates under the current constraints.",
  validate: "Geometry rules plus agent-side checks (popular-booth distance, completeness).",
  simulate: "Same scenario, seed and grid as every other iteration.",
  compare: "Metrics vs previous and baseline; stop or continue is decided in code.",
  analyze: "Reads summarized metrics and hotspots — never raw grids — and names causes.",
  revise: "Muse proposes constraint-level changes; code validates and translates them.",
  report: "Code renders every table and number; Muse writes only the prose.",
};

/** The fixed pipeline as drawn in the explainer. */
export const PIPELINE: { label: string; actor: ActorId; note: string }[] = [
  { label: "Site + booth list", actor: "code", note: "venue file, booth specs, locked scenario" },
  { label: "Design brief", actor: "muse", note: "intent: aisles, clearances, open areas, pins" },
  { label: "Place booths", actor: "ortools", note: "coordinates from constraints" },
  { label: "Check geometry", actor: "shapely", note: "overlap, zones, aisles, reachability" },
  { label: "Simulate crowd", actor: "jupedsim", note: "density, travel time, trajectories" },
  { label: "Analyze + revise", actor: "muse", note: "causes → constraint changes" },
  { label: "Report", actor: "muse", note: "prose by Muse, numbers by code" },
];
