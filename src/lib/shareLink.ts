// src/lib/shareLink.ts
import type { SplitSession } from "@/src/lib/types";

/**
 * Base64url encode/decode (no extra deps).
 * Note: URL length can grow if you have many items; later we can switch to backend share codes.
 */
function base64UrlEncode(str: string) {
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(str, "utf8").toString("base64")
      : window.btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const input = b64 + pad;

  if (typeof window === "undefined") {
    return Buffer.from(input, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(window.atob(input)));
}

/** Avoid unserializable stuff */
export function encodeSessionToParam(session: SplitSession) {
  const json = JSON.stringify(session);
  return base64UrlEncode(json);
}

export function decodeSessionFromParam(param: string): SplitSession | null {
  try {
    const json = base64UrlDecode(param);
    const parsed = JSON.parse(json);
    return parsed as SplitSession;
  } catch {
    return null;
  }
}
