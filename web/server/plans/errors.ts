import "server-only";
export class PlanServiceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
