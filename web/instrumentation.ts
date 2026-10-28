export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // First run: give an empty local database the tracked sample drawings as projects.
  const { seedSampleProjects } = await import("@/server/projects/samples");
  try { seedSampleProjects(); } catch (error) { console.error("Could not seed sample projects:", error); }
}
