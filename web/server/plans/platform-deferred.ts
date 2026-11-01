import "server-only";

/** Legacy URLs remain inert; historical booth storage is deliberately untouched. */
export function platformDeferred(_request?: Request, _context?: unknown) {
  void _request;
  void _context;
  return Response.json({
    code: "PLATFORM_DEFERRED",
    error: "Participation and booth management are no longer available. Open the design studio to work with drawings and brand sources.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
