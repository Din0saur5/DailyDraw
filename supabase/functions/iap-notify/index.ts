// ✅ REQUIRED so Supabase doesn't try to validate JWT
export const config = {
  verifyJWT: false
};

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createSupabaseClient } from "../_shared/runtime/supabaseClient.ts";

const JWKS_PROD =
  "https://api.storekit.itunes.apple.com/inApps/v1/notifications/jwsPublicKeys";

const JWKS_SANDBOX =
  "https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications/jwsPublicKeys";

// --- utilities ---

const text = (message: string) =>
  new Response(JSON.stringify({ ok: true, message }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

const base64UrlToUint8Array = (input: string) => {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const decodePayload = (jws: string) => {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  const json = new TextDecoder().decode(base64UrlToUint8Array(parts[1]));
  return JSON.parse(json);
};

const verifyJws = async (jws: string, jwksUrl: string) => {
  try {
    const res = await fetch(jwksUrl);
    if (!res.ok) return false;

    const { keys = [] } = await res.json();
    if (!keys.length) return false;

    const [headerB64, payloadB64, sigB64] = jws.split(".");
    const header = JSON.parse(
      new TextDecoder().decode(base64UrlToUint8Array(headerB64))
    );
    const { kid, alg = "ES256" } = header;

    const match = kid ? keys.find((k: any) => k.kid === kid) : keys[0];
    if (!match) return false;

    const key = await crypto.subtle.importKey(
      "jwk",
      { ...match, ext: true },
      alg === "ES256"
        ? { name: "ECDSA", namedCurve: "P-256" }
        : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlToUint8Array(sigB64);

    return await crypto.subtle.verify(
      alg === "ES256"
        ? { name: "ECDSA", hash: "SHA-256" }
        : { name: "RSASSA-PKCS1-v1_5" },
      key,
      sig,
      data
    );
  } catch (err) {
    console.warn("[iap-notify] verify error", err);
    return false;
  }
};

// --- main handler ---

serve(async (req) => {
  if (req.method !== "POST") return text("ok");

  let body;
  try {
    body = await req.json();
  } catch {
    console.warn("[iap-notify] bad JSON");
    return text("ok");
  }

  if (!body?.signedPayload) {
    console.warn("[iap-notify] missing signedPayload");
    return text("ok");
  }

  const outer = decodePayload(body.signedPayload);
  if (!outer) {
    console.warn("[iap-notify] cannot decode signedPayload");
    return text("ok");
  }

  // ✅ TEST NOTIFICATIONS MUST ALWAYS RETURN 200
  if (outer.notificationType === "TEST") {
    console.log("[iap-notify] ✅ received TEST notification");
    return text("ok");
  }

  const environment = outer.data?.environment; // "Sandbox" or "Production"
  const jwksUrl =
    environment === "Sandbox" ? JWKS_SANDBOX : JWKS_PROD;

  const verified = await verifyJws(body.signedPayload, jwksUrl);

  if (!verified) {
    console.warn("[iap-notify] signature failed — ignoring");
    return text("ok");
  }

  // --- parse transaction ---

  const signedTx = outer.data?.signedTransactionInfo;
  const tx = signedTx ? decodePayload(signedTx) : null;

  console.log("[iap-notify] ✅ notification", {
    type: outer.notificationType,
    subtype: outer.subtype,
    environment,
    productId: tx?.productId,
    transactionId: tx?.transactionId
  });

  if (!tx) return text("ok");

  // --- update user ---

  const supabase = createSupabaseClient(req);

  await supabase
    .from("users")
    .update({
      apple_product_id: tx.productId ?? null,
      apple_latest_transaction_id: tx.transactionId ?? null,
      premium_expires_at: tx.expiresDate
        ? new Date(Number(tx.expiresDate)).toISOString()
        : null,
      subscription_status:
        outer.notificationType === "EXPIRED" ? "expired" : "active"
    })
    .eq("apple_original_transaction_id", tx.originalTransactionId ?? null);

  return text("ok");
});
