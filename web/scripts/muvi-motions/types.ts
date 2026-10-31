/** Offsets from the canonical rigid-part rig, in Muvi-local coordinates (+Z = work direction). */
export type DesignerPose = Partial<Record<"Body" | "ArmL" | "ArmR" | "FootL" | "FootR" | "EyeL" | "EyeR", {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}>>;
