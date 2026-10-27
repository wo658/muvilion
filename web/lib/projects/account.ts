/** Account boundary for the future authentication adapter. Guest data is never
 * treated as authenticated account data; importing must create a new cloud copy. */
export type WorkspaceIdentity =
  | { kind: "guest" }
  | { kind: "account"; userId: string; name: string; email: string; avatarUrl?: string };

export type AccountProjectImport = {
  localProjectId: string;
  state: "pending" | "uploading" | "saved" | "failed";
  cloudProjectId?: string;
  error?: string;
};

export const CURRENT_IDENTITY: WorkspaceIdentity = { kind: "guest" };
