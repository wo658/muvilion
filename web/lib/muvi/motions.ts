export const MUVI_MOTIONS = ["idle", "hello", "walk", "run", "think", "idea", "cheer", "rest", "sketch", "measure", "partition", "paint"] as const;
export type MuviMotion = typeof MUVI_MOTIONS[number];
export const MUVI_MODEL = "/mascot/muvi-v1.glb";
