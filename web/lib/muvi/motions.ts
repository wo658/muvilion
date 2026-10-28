export const MUVI_MOTIONS = ["idle", "hello", "walk", "run", "think", "idea", "cheer", "rest"] as const;
export type MuviMotion = typeof MUVI_MOTIONS[number];
export const MUVI_MODEL = "/mascot/muvi-v1.glb";
