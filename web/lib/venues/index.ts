/**
 * The sample venues the console can switch between (one replay recording each).
 * Fixture copies live in web/fixtures/ (`pnpm sync:fixtures`; a test checks they match the repo root).
 */
import indoor from "@/fixtures/sample_hall.json";
import outdoor from "@/fixtures/outdoor_plaza.json";
import { ProjectInput, type Scenario } from "@/lib/engine/contract";

export type VenueOption = {
  id: string;
  label: string;
  setting: "indoor" | "outdoor";
  project: ProjectInput;
  /**
   * Scenario fields this venue overrides (live runs and real-engine recordings). Tuned for the
   * real engine; mock recordings use MOCK_RECORDING_ENV instead (lib/agent/recording.ts).
   */
  scenario?: Partial<Scenario>;
};

export const VENUES: VenueOption[] = [
  { id: "sample-hall", label: "Indoor hall", setting: "indoor", project: ProjectInput.parse(indoor) },
  {
    id: "riverside-plaza",
    label: "Outdoor plaza",
    setting: "outdoor",
    project: ProjectInput.parse(outdoor),
    // browse/200 sits right at the target outdoors; an entry rush shows the gate bottleneck.
    scenario: { kind: "entry", agents: 400, seed: 0 },
  },
];

export const DEFAULT_VENUE_ID = VENUES[0].id;

export function venueById(id: string | null | undefined): VenueOption | undefined {
  return VENUES.find((v) => v.id === id);
}

/** Static path of a venue's replay recording (relative to web/). */
export const replayFixturePath = (venueId: string) => `fixtures/replay/${venueId}.json`;

/**
 * POST /api/agent body for the venue picked in the header: live runs send the venue's project
 * (the route validates it as ProjectInput), replays name the venue whose recording to stream.
 */
export function runRequestBody(mode: "live" | "replay", venueId: string): { mode: "live" | "replay"; venue: string; project?: ProjectInput } {
  const v = venueById(venueId);
  if (!v) throw new Error(`unknown venue ${venueId}`);
  return mode === "live" ? { mode, venue: v.id, project: v.project } : { mode, venue: v.id };
}
