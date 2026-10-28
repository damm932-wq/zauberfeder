// DIE ZAUBERFEDER V7
// Cloudflare Pages Function
// TikFinity Webhook + Cloudflare KV

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*"
};

function reply(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

function findName(data) {
  const objects = [
    data,
    data?.data,
    data?.user,
    data?.data?.user,
    data?.event,
    data?.event?.user,
    data?.userInfo,
    data?.data?.userInfo
  ].filter(x => x && typeof x === "object");

  const fields = [
    "nickname",
    "displayName",
    "display_name",
    "nickName",
    "userNickname",
    "name",
    "username",
    "uniqueId",
    "unique_id"
  ];

  for (const obj of objects) {
    for (const field of fields) {
      if (
        typeof obj[field] === "string" &&
        obj[field].trim()
      ) {
        return obj[field].trim().slice(0, 100);
      }
    }
  }

  return "";
}

export async function onRequest({ request, env }) {
  try {
    if (!env.EVENTS) {
      return reply(503, {
        error: "KV binding EVENTS fehlt"
      });
    }

    const url = new URL(request.url);
    const params = url.searchParams;

    const type = params.get("type");

    // Normale Abfragen der Zauberfeder
    // bleiben unverändert möglich.

    if (request.method === "GET" && !type) {
      const after = Number(params.get("after") || 0);
      const since = Number(params.get("since") || 0);

      const events =
        (await env.EVENTS.get("events", "json")) || [];

      return reply(200, {
        events: events
          .filter(e => e.id > after && e.at >= since)
          .slice(-40)
      });
    }

    // Nur GET und POST zulassen.

    if (
      request.method !== "GET" &&
      request.method !== "POST"
    ) {
      return reply(405, {
        error: "Method not allowed"
      });
    }

    // Sicherheitsschlüssel kontrollieren.

    const secret = env.ZAUBERFEDER_WEBHOOK_KEY;

    if (!secret) {
      return reply(503, {
        error: "Webhook security key missing"
      });
    }

    if (params.get("key") !== secret) {
      return reply(403, {
        error: "Unauthorized"
      });
    }

    // Ereignistyp kontrollieren.

    if (!["name", "donut", "join"].includes(type)) {
      return reply(400, {
        error: "Invalid event type"
      });
    }

    // Namen aus URL oder POST-Daten übernehmen.

    let data = {};

    if (request.method === "POST") {
      try {
        data = await request.json();
      } catch {
        data = {};
      }
    }

    const name =
      findName(data) ||
      params.get("displayName") ||
      params.get("nickname") ||
      params.get("username") ||
      params.get("name") ||
      "";

    const cleanName = String(name).trim().slice(0, 100);

    if (!cleanName) {
      return reply(422, {
        error: "No username received"
      });
    }

    // Ereignisse aus Cloudflare KV lesen.

    const events =
      (await env.EVENTS.get("events", "json")) || [];

    const now = Date.now();

    const id = Math.max(
      now,
      (events.at(-1)?.id || 0) + 1
    );

    // Neues Ereignis speichern.

    events.push({
      id,
      at: now,
      type,
      name: cleanName
    });

    await env.EVENTS.put(
      "events",
      JSON.stringify(events.slice(-160))
    );

    return reply(200, {
      ok: true,
      type,
      name: cleanName
    });

  } catch (error) {
    return reply(500, {
      error: String(error.message || error)
    });
  }
}
