/*  여행 일정 서버 저장 — Vercel Blob
 *  GET  /api/trip           → { ok, updatedAt, data, source, warn }
 *  PUT  /api/trip           → { base, force, data }  헤더 x-edit-key
 *  저장소가 비어 있으면 lib/seed.js 의 기준본을 돌려줍니다.
 */
import { get, put } from '@vercel/blob';
import SEED from '../lib/seed.js';

const PATH = 'trip.json';
const SEED_AT = 1787184000000;        /* 2026-08-20 내보내기 */

/* Blob 저장소가 프로젝트에 연결돼 있는지 — 없으면 SDK 를 부르지 않습니다 */
function hasStore(){
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function json(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }
  });
}

async function readBlob(){
  if(!hasStore()) return null;
  try{
    const r = await get(PATH, { access:'private', useCache:false, abortSignal:AbortSignal.timeout(6000) });
    if(!r || r.statusCode !== 200 || !r.stream) return null;
    const txt = await new Response(r.stream).text();
    const o = JSON.parse(txt);
    return (o && o.data) ? o : null;
  }catch(e){
    return null;                      /* 없음 · 토큰 미설정 → 기준본으로 */
  }
}

export default async function handler(request){
  const key = process.env.EDIT_KEY || '';

  if(request.method === 'GET'){
    const cur = await readBlob();
    if(cur) return json({ ok:true, source:'blob', updatedAt:cur.updatedAt||0, data:cur.data, warn:key?'':'nokey' });
    return json({ ok:true, source:'seed', updatedAt:SEED_AT, data:SEED, warn:key?'':'nokey' });
  }

  if(request.method === 'PUT' || request.method === 'POST'){
    if(!hasStore())
      return json({ ok:false, error:'store', msg:'Blob 저장소가 프로젝트에 연결돼 있지 않습니다' }, 503);
    if(key && request.headers.get('x-edit-key') !== key)
      return json({ ok:false, error:'key' }, 401);

    let body;
    try{ body = await request.json(); }catch(e){ return json({ ok:false, error:'bad-json' }, 400); }
    if(!body || !body.data || typeof body.data !== 'object' || !Array.isArray(body.data.days))
      return json({ ok:false, error:'no-data' }, 400);

    /* 다른 기기가 먼저 저장했는지 확인 */
    const cur = await readBlob();
    const curAt = cur ? (cur.updatedAt||0) : 0;
    if(!body.force && curAt && Number(body.base||0) < curAt)
      return json({ ok:false, error:'conflict', updatedAt:curAt, data:cur.data }, 409);

    const updatedAt = Date.now();
    try{
      await put(PATH, JSON.stringify({ updatedAt, data:body.data }), {
        access:'private', addRandomSuffix:false, allowOverwrite:true,
        contentType:'application/json', cacheControlMaxAge:60,
        abortSignal:AbortSignal.timeout(9000)
      });
    }catch(e){
      return json({ ok:false, error:'store', msg:String(e && e.message || e) }, 500);
    }
    return json({ ok:true, updatedAt });
  }

  return json({ ok:false, error:'method' }, 405);
}
