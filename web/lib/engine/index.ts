import { createHttpEngine, type Engine } from "./client";
import { createMockEngine } from "./mock";

export type { Engine } from "./client";
export { EngineError } from "./client";

/** ENGINE_MOCK=1 → in-process deterministic mock; otherwise HTTP to ENGINE_URL. */
export function getEngine(env: NodeJS.ProcessEnv = process.env): Engine {
  if (env.ENGINE_MOCK === "1" || env.ENGINE_MOCK === "true") return createMockEngine();
  return createHttpEngine({ baseUrl: env.ENGINE_URL });
}
