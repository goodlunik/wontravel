/*  여행 일정 서버 저장 — Vercel Blob
 *  GET  /api/trip  → { ok, ver, source, updatedAt, data, warn }
 *  PUT  /api/trip  → { base, force, data }   헤더 x-edit-key
 *  저장소가 비어 있으면 lib/seed.js 의 기준본을 돌려줍니다.
 */
import { get, put } from '@vercel/blob';
import SEED from '../lib/seed.js';

const VER = 3;
const PATH = 'trip.json';
const SEED_AT = 1787184000000;        /* 2026-08-20 내보내기 */

/* Blob 저장소가 프로젝트에 연결돼 있는지 — 없으면 SDK 를 부르지 않습니다 */
function hasStore(){
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
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

export default async function handler(req, res){
  const key = process.env.EDIT_KEY || '';
  const send = (body, status) => {
    res.statusCode = status || 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(body));
  };

  try{
    if(req.method === 'GET'){
      const cur = await readBlob();
      const warn = hasStore() ? (key ? '' : 'nokey') : 'nostore';
      if(cur) return send({ ok:true, ver:VER, source:'blob', updatedAt:cur.updatedAt||0, data:cur.data, warn });
      return send({ ok:true, ver:VER, source:'seed', updatedAt:SEED_AT, data:SEED, warn });
    }

    if(req.method === 'PUT' || req.method === 'POST'){
      if(!hasStore())
        return send({ ok:false, error:'store', msg:'Blob 저장소가 프로젝트에 연결돼 있지 않습니다' }, 503);
      if(key && req.headers['x-edit-key'] !== key)
        return send({ ok:false, error:'key' }, 401);

      let body = req.body;
      if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = null; } }
      if(!body){
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try{ body = JSON.parse(raw); }catch(e){ return send({ ok:false, error:'bad-json' }, 400); }
      }
      if(!body || !body.data || typeof body.data !== 'object' || !Array.isArray(body.data.days))
        return send({ ok:false, error:'no-data' }, 400);

      /* 다른 기기가 먼저 저장했는지 확인 */
      const cur = await readBlob();
      const curAt = cur ? (cur.updatedAt||0) : 0;
      if(!body.force && curAt && Number(body.base||0) < curAt)
        return send({ ok:false, error:'conflict', updatedAt:curAt, data:cur.data }, 409);

      const updatedAt = Date.now();
      await put(PATH, JSON.stringify({ updatedAt, data:body.data }), {
        access:'private', addRandomSuffix:false, allowOverwrite:true,
        contentType:'application/json', cacheControlMaxAge:60,
        abortSignal:AbortSignal.timeout(9000)
      });
      return send({ ok:true, ver:VER, updatedAt });
    }

    return send({ ok:false, error:'method' }, 405);
  }catch(e){
    return send({ ok:false, error:'server', msg:String((e && e.message) || e) }, 500);
  }
}
