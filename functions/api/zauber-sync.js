// ZAUBERFEDER V9.3 – Synchronisation
// Cloudflare Pages Function
// KV-Bindung: EVENTS

const KEY = "zauberfeder:sync:v93";

function antwort(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequest({ request, env }) {
  try {
    if (!env.EVENTS) {
      return antwort({
        ok: false,
        error: "KV-Bindung EVENTS fehlt"
      }, 500);
    }

    // Zuschauer dürfen den Zustand lesen.
    if (request.method === "GET") {
      const state = await env.EVENTS.get(KEY, "json");

      return antwort({
        ok: true,
        state: state || null,
        serverTime: Date.now()
      });
    }

    if (request.method !== "POST") {
      return antwort({
        ok: false,
        error: "Methode nicht erlaubt"
      }, 405);
    }

    // Schreibzugriff nur mit geheimem Schlüssel.
    const secret = env.ZAUBER_SYNC_SECRET;

    if (!secret) {
      return antwort({
        ok: false,
        error: "Synchronisationsschlüssel fehlt"
      }, 503);
    }

    const supplied = request.headers.get("X-Zauber-Sync-Key");

    if (!supplied || supplied !== secret) {
      return antwort({
        ok: false,
        error: "Nicht autorisiert"
      }, 401);
    }

    const raw = await request.text();

    if (raw.length > 24000) {
      return antwort({
        ok: false,
        error: "Daten zu groß"
      }, 413);
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return antwort({
        ok: false,
        error: "Ungültiges JSON"
      }, 400);
    }

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return antwort({
        ok: false,
        error: "Ungültiger Zustand"
      }, 400);
    }

    const state = {
      ...data,
      updatedAt: Date.now()
    };

    await env.EVENTS.put(
      KEY,
      JSON.stringify(state),
      { expirationTtl: 3600 }
    );

    return antwort({
      ok: true,
      updatedAt: state.updatedAt
    });

  } catch (error) {
    return antwort({
      ok: false,
      error: "Interner Serverfehler"
    }, 500);
  }
}
