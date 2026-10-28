// Cloudflare Pages Function – TikFinity events
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
const reply = (status, value) => new Response(JSON.stringify(value), { status, headers });
function findName(data) {
  const objs = [data, data?.data, data?.user, data?.data?.user, data?.event, data?.event?.user, data?.userInfo, data?.data?.userInfo].filter(x => x && typeof x === 'object');
  for (const o of objs) for (const k of ['nickname','displayName','display_name','nickName','userNickname','name','username','uniqueId','unique_id']) {
    if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim().slice(0,100);
  }
  return '';
}
export async function onRequest({ request, env }) {
  try {
    if (!env.EVENTS) return reply(503,{error:'KV binding EVENTS fehlt'});
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      const since = Number(url.searchParams.get('since') || 0);
      const events = (await env.EVENTS.get('events', 'json')) || [];
      return reply(200, { events: events.filter(e => e.id > after && e.at >= since).slice(-40) });
    }
    if (request.method !== 'POST') return reply(405,{error:'Method not allowed'});
    if (!env.ZAUBERFEDER_WEBHOOK_KEY || url.searchParams.get('key') !== env.ZAUBERFEDER_WEBHOOK_KEY) return reply(403,{error:'Unauthorized'});
    const type = url.searchParams.get('type');
    if (!['name','donut','join'].includes(type)) return reply(400,{error:'Invalid event type'});
    let data = {}; try { data = await request.json(); } catch {}
    const name = findName(data);
    if (!name) return reply(422,{error:'No display name in webhook payload', receivedKeys:Object.keys(data||{}).slice(0,20)});
    const events = (await env.EVENTS.get('events','json')) || [];
    const now = Date.now(); const id = Math.max(now,(events.at(-1)?.id||0)+1);
    events.push({id,at:now,type,name});
    await env.EVENTS.put('events',JSON.stringify(events.slice(-160)));
    return reply(200,{ok:true,type,name});
  } catch(e) { return reply(500,{error:String(e.message||e)}); }
}
