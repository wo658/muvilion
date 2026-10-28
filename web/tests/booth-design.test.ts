import { describe, expect, it } from "vitest";
import { boothHandoff, importBoothDesignIntoVenue, createBoothDocument, createBoothReviewSession, sanitizeBoothDocument, validateBoothDesign } from "@/lib/booths/design";
import type { DesignObject } from "@/lib/plans/schema";

const bounds = { id: "booth-a", name: "A", width: 4, depth: 3, maxHeight: 2.5 };
const counter: DesignObject = { id: "counter", label: "Counter", kind: "furniture", x: 0.5, y: 0.5, width: 1, depth: 0.5, height: 1, rotation: 0, color: "#ffffff" };

describe("scoped booth design", () => {
  it("checks rotation, actual bottom elevation, and full footprint", () => {
    expect(validateBoothDesign(bounds, [counter])).toEqual([]);
    expect(validateBoothDesign(bounds, [{ ...counter, x: 0.01 }])).not.toEqual([]);
    expect(validateBoothDesign(bounds, [{ ...counter, width: 3.5, rotation: 90 }])).not.toEqual([]);
    expect(validateBoothDesign(bounds, [{ ...counter, elevation: 2 }])).not.toEqual([]);
  });
  it("rejects intersecting objects but permits separated vertical layers", () => {
    expect(validateBoothDesign(bounds, [counter, { ...counter, id: "second" }])).not.toEqual([]);
    expect(validateBoothDesign(bounds, [counter, { ...counter, id: "light", kind: "light", elevation: 2, height: 0.2 }])).toEqual([]);
  });
  it("rejects duplicate identities and cross-zone references", () => {
    expect(validateBoothDesign(bounds, [counter, counter])).not.toEqual([]);
    expect(validateBoothDesign(bounds, [{ ...counter, zoneId: "another-booth" }])).not.toEqual([]);
  });
  it("requires a successful check of the exact submitted objects", () => {
    const session = createBoothReviewSession(bounds);
    expect(session.submit([counter]).accepted).toBe(false);
    expect(session.validate([counter]).valid).toBe(true);
    expect(session.submit([{ ...counter, x: 0.6 }]).accepted).toBe(false);
    expect(session.submit([counter]).accepted).toBe(true);
    expect(session.result()).toEqual([counter]);
  });
  it("does not accept a candidate after a failed check", () => {
    const session = createBoothReviewSession(bounds);
    session.validate([counter]);
    session.validate([{ ...counter, height: 3 }]);
    expect(session.submit([counter]).accepted).toBe(false);
    expect(session.result()).toBeNull();
  });
  it("rebuilds immutable booth metadata when handling a client document", () => {
    const doc = createBoothDocument(bounds, [counter]);
    const result = sanitizeBoothDocument(bounds, { ...doc, widthMeters: 100, wallHeight: 30, texts: [{ id: "secret", text: "other participant", x: 0, y: 0 }] });
    expect(result.widthMeters).toBe(4);
    expect(result.wallHeight).toBe(2.5);
    expect(result.texts).toEqual([]);
    expect(result.lines).toEqual([]);
    expect(boothHandoff(result).status).toBe("concept");
    expect(boothHandoff(result).items).toEqual([expect.objectContaining({ label: "Counter", quantity: 1 })]);
  });
});


describe("organizer venue import", () => {
  const venue = createBoothDocument({ id: "venue", name: "Venue", width: 20, depth: 20, maxHeight: 4 });
  venue.zones = [{ id: "zone-a", label: "A", purpose: "booth", assignable: true, x: 0.5, y: 0.5, width: 4, depth: 3, rotation: 90 }];
  const listing = { ...bounds, zoneId: "zone-a" };
  it("maps a rotated booth into venue coordinates and replaces only its own objects", () => {
    const design = [{ ...counter, x: 0.75 }];
    const imported = importBoothDesignIntoVenue(venue, listing, "app-a", design);
    expect(imported.objects?.[0]).toMatchObject({ x: 0.5, y: 0.55, rotation: 90, zoneId: "zone-a" });
    const replaced = importBoothDesignIntoVenue(imported, listing, "app-a", [counter]);
    expect(replaced.objects).toHaveLength(1);
    expect(replaced.objects?.[0].y).toBe(0.5);
  });
  it("rejects changed dimensions and collisions in the venue", () => {
    expect(() => importBoothDesignIntoVenue(venue, { ...listing, width: 5 }, "app-a", [counter])).toThrow();
    const occupied = { ...venue, objects: [counter] };
    expect(() => importBoothDesignIntoVenue(occupied, listing, "app-a", [counter])).toThrow(/overlaps/);
  });
});
