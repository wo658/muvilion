export const MUVI_MOTIONS = ["idle", "hello", "walk", "run", "think", "idea", "cheer", "rest", "inspect", "measure", "arrange", "paint"] as const;
export type MuviMotion = typeof MUVI_MOTIONS[number];
export const MUVI_MODEL = "/mascot/muvi-v1.glb";

/** In-place work phrases share a neutral entry/exit and use local +Z as work direction. */
export const MUVI_DESIGNER_DURATION = 5;
export const MUVI_DESIGNER_MOTIONS = ["inspect", "measure", "arrange", "paint"] as const;
