/*  여행 일정 서버 저장 — Vercel Blob
 *  GET  /api/trip            → { ok, ver, source, updatedAt, data, warn }
 *  GET  /api/trip?snaps=1    → { ok, snaps:[{at,iso,name,size}] }   기록 목록
 *  GET  /api/trip?snap=<name|at|latest> → { ok, at, name, data }    그때의 일정
 *  PUT  /api/trip            → { base, force, data }   헤더 x-edit-key
 *  저장소가 비어 있으면 lib/seed.js 의 기준본을 돌려줍니다.
 *
 *  기록(스냅숏)은 저장이 일어날 때만, 마지막 기록에서 1시간이 지났을 때만 남깁니다.
 *  — 고친 게 없으면 저장 자체가 없으므로 기록도 쌓이지 않습니다.
 */
import { get, put, list, del } from '@vercel/blob';
import SEED from '../lib/seed.js';

const VER = 4;
const PATH = 'trip.json';
const SEED_AT = 1787184000000;        /* 2026-08-20 내보내기 */
const SNAP_DIR   = 'snap/';
const SNAP_EVERY = 60 * 60 * 1000;    /* 1시간에 한 번 */
const SNAP_KEEP  = 400;               /* 오래된 기록은 잘라 냅니다 */

const snapName = (at) => SNAP_DIR + new Date(at).toISOString().replace(/[:.]/g, '-') + '.json';
const snapAt   = (name) => {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(String(name));
  if (!m) return 0;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`) || 0;
};

async function readJson(path){
  if(!hasStore()) return null;
  try{
    const r = await get(path, { access:'private', useCache:false, abortSignal:AbortSignal.timeout(6000) });
    if(!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  }catch(e){
    return null;
  }
}

async function listSnaps(){
  if(!hasStore()) return [];
  try{
    const r = await list({ prefix:SNAP_DIR, limit:1000, abortSignal:AbortSignal.timeout(6000) });
    return (r.blobs||[])
      .map(b => ({ name:b.pathname, at:snapAt(b.pathname)||Date.parse(b.uploadedAt)||0, size:b.size }))
      .sort((a,b) => b.at - a.at);
  }catch(e){
    return [];
  }
}

/* 저장할 때마다 부르지만, 실제로 남기는 건 1시간에 한 번 */
async function keepSnap(at, data, lastAt){
  if(at - (lastAt||0) < SNAP_EVERY) return lastAt||0;
  try{
    await put(snapName(at), JSON.stringify({ updatedAt:at, data }), {
      access:'private', addRandomSuffix:false, allowOverwrite:true,
      contentType:'application/json', abortSignal:AbortSignal.timeout(9000)
    });
    const all = await listSnaps();
    const old = all.slice(SNAP_KEEP).map(o => o.name);
    if(old.length) await del(old);
    return at;
  }catch(e){
    return lastAt||0;                 /* 기록 실패가 본 저장을 막지는 않습니다 */
  }
}

/* Blob 저장소가 프로젝트에 연결돼 있는지 — 없으면 SDK 를 부르지 않습니다 */
function hasStore(){
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function readBlob(){
  const o = await readJson(PATH);     /* 없음 · 토큰 미설정 → 기준본으로 */
  return (o && o.data) ? o : null;
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
      const q = new URL(req.url, 'http://x').searchParams;

      /* 기록 목록 */
      if(q.has('snaps')){
        const snaps = await listSnaps();
        return send({ ok:true, ver:VER, count:snaps.length,
                      snaps: snaps.map(o => ({ ...o, iso:new Date(o.at).toISOString() })) });
      }
      /* 기록 하나 — 이름 · 시각(ms) · latest · 그 시각 이전의 가장 최근 것 */
      if(q.has('snap')){
        const want = String(q.get('snap')||'').trim();
        const snaps = await listSnaps();
        if(!snaps.length) return send({ ok:false, error:'no-snap' }, 404);
        let hit = null;
        if(!want || want === 'latest') hit = snaps[0];
        else if(/^\d{10,}$/.test(want)){
          const t = Number(want);
          hit = snaps.find(o => o.at === t) || snaps.find(o => o.at <= t) || null;
        }else{
          hit = snaps.find(o => o.name === want || o.name === SNAP_DIR + want) || null;
        }
        if(!hit) return send({ ok:false, error:'no-snap' }, 404);
        const rec = await readJson(hit.name);
        if(!rec || !rec.data) return send({ ok:false, error:'no-snap' }, 404);
        return send({ ok:true, ver:VER, at:hit.at, iso:new Date(hit.at).toISOString(),
                      name:hit.name, data:rec.data });
      }

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
      const snapped = await keepSnap(updatedAt, body.data, cur ? (cur.snapAt||0) : 0);
      await put(PATH, JSON.stringify({ updatedAt, snapAt:snapped, data:body.data }), {
        access:'private', addRandomSuffix:false, allowOverwrite:true,
        contentType:'application/json', cacheControlMaxAge:60,
        abortSignal:AbortSignal.timeout(9000)
      });
      return send({ ok:true, ver:VER, updatedAt, snapAt:snapped });
    }

    return send({ ok:false, error:'method' }, 405);
  }catch(e){
    return send({ ok:false, error:'server', msg:String((e && e.message) || e) }, 500);
  }
}
