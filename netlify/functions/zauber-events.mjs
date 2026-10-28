import { getStore } from '@netlify/blobs';

const secret = process.env.ZAUBERFEDER_WEBHOOK_KEY || 'IlwQ483DsePX6iUpMvG2y-kvmU7MXg';
const cors = {'access-control-allow-origin':'*','content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const reply=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:cors});
function findName(data){
 const objects=[data,data?.data,data?.user,data?.data?.user,data?.event,data?.event?.user,data?.userInfo,data?.data?.userInfo].filter(x=>x&&typeof x==='object');
 for(const o of objects){for(const k of ['nickname','displayName','display_name','nickName','userNickname','name','username','uniqueId','unique_id']){
  const v=o[k];if(typeof v==='string'&&v.trim())return v.trim().slice(0,100);
 }}
 return '';
}
export default async (request)=>{
 try{
  const url=new URL(request.url),store=getStore('zauberfeder-live-events');
  if(request.method==='GET'){
   const after=Number(url.searchParams.get('after')||0),since=Number(url.searchParams.get('since')||0);
   const events=(await store.get('events',{type:'json'}))||[];
   return reply(200,{events:events.filter(e=>e.id>after&&e.at>=since).slice(-40)});
  }
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  if(url.searchParams.get('key')!==secret)return reply(403,{error:'Unauthorized'});
  const type=url.searchParams.get('type');
  if(!['name','donut','join'].includes(type))return reply(400,{error:'Invalid event type'});
  let data={};try{data=await request.json()}catch{}
  const name=findName(data);
  if(!name)return reply(422,{error:'No display name in webhook payload',receivedKeys:Object.keys(data||{}).slice(0,20)});
  const events=(await store.get('events',{type:'json'}))||[];
  const now=Date.now();const id=Math.max(now,(events.at(-1)?.id||0)+1);
  events.push({id,at:now,type,name});
  await store.setJSON('events',events.slice(-160));
  return reply(200,{ok:true,type,name});
 }catch(err){return reply(500,{error:String(err.message||err)})}
};
export const config={path:'/.netlify/functions/zauber-events'};
