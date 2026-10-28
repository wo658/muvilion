/**
 * Compile-time drift check between the hand-written zod contract (contract.ts) and the
 * types generated from the engine's OpenAPI spec (openapi.gen.ts).
 *
 * `pnpm typecheck` fails here when a field is added, removed, renamed or retyped on one
 * side only. Regenerate the spec with `pnpm gen:engine-types` after changing
 * engine/app/schemas.py, then update contract.ts until this file compiles.
 *
 * Both sides are compared in their parsed (output) shape: fields with defaults are present,
 * which is how FastAPI emits these schemas. Pydantic leaves `X | None = None` fields out of
 * `required`, so the generated side marks them optional; DeepRequired evens that out.
 */
import type { z } from "zod";
import type { components } from "./openapi.gen";
import type * as C from "./contract";

type DeepRequired<T> = T extends (infer E)[]
  ? DeepRequired<E>[]
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<T[K]> }
    : T;

type Engine = { [K in keyof components["schemas"]]: DeepRequired<components["schemas"][K]> };

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

type Out<S extends z.ZodType> = z.output<S>;

export type ContractDrift = [
  Assert<Same<Out<typeof C.Point>, Engine["Point"]>>,
  Assert<Same<Out<typeof C.Rect>, Engine["Rect"]>>,
  Assert<Same<Out<typeof C.Obstacle>, Engine["Obstacle"]>>,
  Assert<Same<Out<typeof C.Door>, Engine["Door"]>>,
  Assert<Same<Out<typeof C.Zone>, Engine["Zone"]>>,
  Assert<Same<Out<typeof C.Venue>, Engine["Venue"]>>,
  Assert<Same<Out<typeof C.BoothSpec>, Engine["BoothSpec"]>>,
  Assert<Same<Out<typeof C.Booth>, Engine["Booth"]>>,
  Assert<Same<Out<typeof C.Layout>, Engine["Layout"]>>,
  Assert<Same<Out<typeof C.LayoutConstraints>, Engine["LayoutConstraints"]>>,
  Assert<Same<Out<typeof C.LayoutRequest>, Engine["LayoutRequest"]>>,
  Assert<Same<Out<typeof C.LayoutResponse>, Engine["LayoutResponse"]>>,
  Assert<Same<Out<typeof C.Violation>, Engine["Violation"]>>,
  Assert<Same<Out<typeof C.ValidateRequest>, Engine["ValidateRequest"]>>,
  Assert<Same<Out<typeof C.ValidateResponse>, Engine["ValidateResponse"]>>,
];
