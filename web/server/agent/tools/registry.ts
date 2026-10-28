import "server-only";
import type { ToolSet } from "ai";

export type DesignPhase = "initial" | "revision";
export type ToolRegistration<Context> = {
  name: string;
  category: "design" | "image" | "asset" | "3d";
  phases: readonly DesignPhase[];
  available?: (context: Context) => boolean;
  create: (context: Context) => ToolSet[string];
};

/** Request-scoped factories: never share draft state or credentials between runs. */
export function createToolRegistry<Context>(registrations: readonly ToolRegistration<Context>[], context: Context, phase: DesignPhase): ToolSet {
  const tools: ToolSet = {};
  const names = new Set<string>();
  for (const entry of registrations) {
    if (!/^[a-z][a-z0-9_]*$/.test(entry.name) || names.has(entry.name))
      throw new Error(`Invalid or duplicate tool registration: ${entry.name}`);
    names.add(entry.name);
    if (entry.phases.includes(phase) && (entry.available?.(context) ?? true))
      tools[entry.name] = entry.create(context);
  }
  return tools;
}
