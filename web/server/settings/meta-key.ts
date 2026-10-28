import "server-only";
import type { Env } from "@/lib/env";
import { MetaKeyAction, type MetaKeyStatus } from "@/lib/meta-key";
import { removeMetaKey, saveMetaKey, storedMetaKey } from "./store";

export function keyStatus(env: Env = process.env): MetaKeyStatus {
  const stored = Boolean(storedMetaKey());
  const activeProvider = stored ? "meta" : env.MODEL_PROVIDER === "baseten" ? "baseten" : "meta";
  const environmentAvailable = Boolean(env.MODEL_API_KEY?.trim());
  const activeEnvironment = activeProvider === "meta" ? environmentAvailable : Boolean(env.BASETEN_API_KEY?.trim());
  return { stored, environmentAvailable, activeProvider, source: stored ? "sqlite" : activeEnvironment ? "environment" : "none" };
}

export function changeKey(input: unknown, env: Env = process.env): MetaKeyStatus {
  const action = MetaKeyAction.parse(input);
  if (action.action === "save") saveMetaKey(action.key);
  if (action.action === "remove") removeMetaKey();
  if (action.action === "import") {
    // Next loads .env.local on the server. Never send the value to the browser.
    const parsed = MetaKeyAction.safeParse({ action: "save", key: env.MODEL_API_KEY });
    if (!parsed.success || parsed.data.action !== "save") throw new Error("No environment key available");
    saveMetaKey(parsed.data.key);
  }
  return keyStatus(env);
}

/** No-login storage is available through loopback or an explicitly configured app origin. */
export function localSettingsRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  // Next may normalize req.url to localhost while preserving a 127.0.0.1 Host.
  let publicUrl: URL;
  try { publicUrl = new URL(`${url.protocol}//${host}`); } catch { return false; }
  const loopback = ["localhost", "127.0.0.1", "[::1]"];
  let configuredOrigin: string | undefined;
  try {
    const configured = process.env.APP_ORIGIN?.trim().replace(/\/$/, "");
    if (configured && new URL(configured).origin === configured && /^https?:\/\//.test(configured)) configuredOrigin = configured;
  } catch { /* Invalid configuration never broadens access. */ }
  // Next builds the internal URL from its bind address when started with --hostname 0.0.0.0.
  const configuredBind = Boolean(configuredOrigin) && publicUrl.origin === configuredOrigin && url.hostname === "0.0.0.0" && url.protocol === publicUrl.protocol && url.port === publicUrl.port;
  const internalAllowed = loopback.includes(url.hostname) || url.origin === configuredOrigin || configuredBind;
  const publicAllowed = loopback.includes(publicUrl.hostname) || publicUrl.origin === configuredOrigin;
  if (!internalAllowed || !publicAllowed) return false;
  if (publicUrl.host !== host || publicUrl.username || publicUrl.password) return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== publicUrl.origin) return false;
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}
