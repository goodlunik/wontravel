/*  일정 AI 재구성 — OpenAI
 *  POST /api/ai   { ask, ctx }  →  { ok, out:{ ttl, sub, note, items[], newPlaces[] } }
 *
 *  키는 Vercel 환경변수 OPENAI_API_KEY 에만 둡니다 (클라이언트에 절대 내려가지 않음).
 *  모델은 OPENAI_MODEL 로 바꿀 수 있습니다 — 기본 gpt-4.1
 */

export const config = { maxDuration: 60 };

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

const S = (d) => ({ type: 'string', description: d });
const N = (d) => ({ type: 'number', description: d });

/* strict 모드 — 모든 키가 required · additionalProperties:false */
const ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['k', 't', 'meal', 'mode', 'dur', 'ref', 'trip', 'x', 'dd'],
  properties: {
    k:    { type:'string', enum:['wake','sleep','meal','spot','tour','stay','move','free'],
            description:'기상/취침/식사/관광지/투어/숙소/이동/자유일정' },
    t:    S('시각 HH:MM (24시간). 모르면 빈 문자열'),
    meal: { type:'string', enum:['b','l','d','s',''], description:'k=meal 일 때만. 아침/점심/저녁/간식' },
    mode: { type:'string', enum:['w','x','b','s','m','t','c','p','f',''],
            description:'k=move 일 때만. 도보/택시/버스/지하철/트램/기차/케이블카/페리/항공' },
    dur:  N('k=move 일 때 소요 분. 모르면 0'),
    ref:  S('카탈로그의 id 또는 newPlaces 의 tmp. 없으면 빈 문자열'),
    trip: S('예매된 교통편 id (trips). 없으면 빈 문자열'),
    x:    S('ref 가 없을 때 쓰는 직접 입력 이름. 없으면 빈 문자열'),
    dd:   S('한 줄 설명·팁. 없으면 빈 문자열')
  }
};

const PLACE = {
  type: 'object',
  additionalProperties: false,
  required: ['tmp','kind','n','cty','tp','d','la','ln'],
  properties: {
    tmp:  S('items[].ref 에서 가리킬 임시 id (예: new1)'),
    kind: { type:'string', enum:['spot','eat'], description:'관광지 / 식당' },
    n:    S('장소 이름 (한국어, 필요하면 현지어 병기)'),
    cty:  S('cities 의 id'),
    tp:   { type:'string', enum:['sg','mk','na','et',''], description:'kind=spot 일 때 관광/마켓/자연·액티비티/기타' },
    d:    S('운영시간·주의사항 등 한 줄 메모'),
    la:   N('위도 (모르면 0)'),
    ln:   N('경도 (모르면 0)')
  }
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ttl','sub','note','items','newPlaces'],
  properties: {
    ttl:  S('그날의 짧은 제목 (예: 고대 로마). 바꿀 필요 없으면 원래 값 그대로'),
    sub:  S('제목 아래 한 줄 요약 (· 로 구분)'),
    note: S('무엇을 왜 바꿨는지 사용자에게 보여줄 1~2문장'),
    items:     { type:'array', items:ITEM,  description:'그날 일정 전체 (시간 오름차순)' },
    newPlaces: { type:'array', items:PLACE, description:'카탈로그에 없어서 새로 만든 장소만' }
  }
};

const SYS = `너는 가족 여행 일정표를 고쳐 주는 도우미다. 하루치 일정을 통째로 다시 짜서 JSON 으로만 답한다.

[반드시 지킬 것]
1. items 는 그날 일정 "전체"다. 사용자가 건드리지 않은 부분도 빠짐없이 그대로 넣어라. 빠뜨리면 삭제된 것으로 처리된다.
2. 장소는 catalog(spots·eats·stays·tours·hubs) 의 id 를 ref 에 그대로 쓰는 것을 최우선으로 한다. 그래야 지도·사진·링크가 살아난다.
3. catalog 에 없는 장소를 새로 넣을 때만 newPlaces 에 담고, items[].ref 는 그 tmp 값을 쓴다. 위도·경도를 아는 만큼 정확히 채워라 (모르면 0).
4. 숙소(stay)·투어(tour)·교통편(trip) 은 새로 만들지 마라. 기존 id 만 쓴다.
5. trip 이 붙은 항목(예매 완료된 기차·항공)은 시각·내용을 바꾸지 말고 그대로 유지한다.
6. 앞날(prev)의 마지막 위치와 다음날(next)의 첫 일정이 이어지도록 짜라. 그날 묵는 숙소·다음날 아침 기차 시각을 깨뜨리지 마라.
7. 하루는 기상(wake) 으로 시작해 취침(sleep) 으로 끝나고, 아침·점심·저녁 식사가 모두 들어간다. 취침은 21:00~24:00 사이로 잡아라. 해가 17시에 져도 저녁은 그대로 쓴다 — 야경·크리스마스 마켓·저녁 식사가 있다.
8. 장소를 옮길 때는 그 사이에 k:"move" 항목을 넣어라. 도보는 mode:"w", 도시 간은 t/f/p 를 쓴다. dur 은 현실적인 분 단위로.
9. 시각은 겹치지 않게 오름차순. 이동 시간과 관람 시간을 현실적으로 잡아라.
10. 겨울(12월 말~1월 초) 유럽이다. 해가 17시경 지고 휴관일·단축 운영이 많다. 크리스마스·신정 당일 휴무를 감안하라.
11. 초등 1학년·6학년 아이가 동행한다. 하루 이동 거리와 도보량을 무리하지 않게 잡아라.
12. dd 는 한국어로, 실제로 도움이 되는 정보만 짧게 (운영시간, 예약 필요, 줄 서는 시간, 아이 관련 팁).
13. 원본 items 의 항목은 하나하나 그대로 살려라. 사용자가 "빼 줘 · 바꿔 줘" 라고 명시한 것만 빼거나 바꾼다. 시각을 옮기는 것은 괜찮지만, 요청하지 않은 항목을 임의로 지우지 마라.
14. 그래서 결과 items 의 개수는 보통 원본과 비슷하거나 그보다 많다. 원본보다 눈에 띄게 짧아졌다면 무언가를 잘못 지운 것이니 다시 채워라.
15. note 에는 무엇을 왜 바꿨는지만 적는다. 지운 항목이 있으면 반드시 그 이유를 밝혀라.`;

export default async function handler(req, res){
  const send = (body, status) => {
    res.statusCode = status || 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(body));
  };

  if(req.method !== 'POST') return send({ ok:false, error:'method' }, 405);

  const apiKey = process.env.OPENAI_API_KEY || '';
  if(!apiKey) return send({ ok:false, error:'nokey', msg:'OPENAI_API_KEY 가 설정되지 않았습니다' }, 503);

  try{
    let body = req.body;
    if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = null; } }
    if(!body){
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try{ body = JSON.parse(raw); }catch(e){ return send({ ok:false, error:'bad-json' }, 400); }
    }

    const ask = String((body && body.ask) || '').trim();
    const ctx = body && body.ctx;
    if(!ask) return send({ ok:false, error:'no-ask', msg:'무엇을 바꿀지 적어 주세요' }, 400);
    if(!ctx || !ctx.day || !Array.isArray(ctx.day.items))
      return send({ ok:false, error:'no-ctx' }, 400);

    const user =
      '# 사용자의 요청\n' + ask +
      '\n\n# 고칠 날짜와 현재 일정\n' + JSON.stringify(ctx.day) +
      '\n\n# 앞날 · 다음날 (연속성 — 바꾸지 말 것)\n' + JSON.stringify({ prev:ctx.prev||null, next:ctx.next||null }) +
      '\n\n# 도시\n' + JSON.stringify(ctx.cities||[]) +
      '\n\n# catalog — ref 에 쓸 수 있는 id 목록\n' + JSON.stringify(ctx.places||{});

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'content-type':'application/json', authorization:'Bearer ' + apiKey },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 8000,
        messages: [{ role:'system', content:SYS }, { role:'user', content:user }],
        response_format: { type:'json_schema',
          json_schema: { name:'day_plan', strict:true, schema:SCHEMA } }
      }),
      signal: AbortSignal.timeout(50000)
    });

    const j = await r.json().catch(() => null);
    if(!r.ok || !j){
      const msg = (j && j.error && j.error.message) || ('OpenAI ' + r.status);
      return send({ ok:false, error:'upstream', msg }, 502);
    }

    const ch = j.choices && j.choices[0];
    if(ch && ch.finish_reason === 'length')
      return send({ ok:false, error:'too-long', msg:'답이 너무 길어 잘렸습니다 — 요청을 조금 더 좁혀 주세요' }, 502);

    const txt = ch && ch.message && ch.message.content;
    if(!txt) return send({ ok:false, error:'empty', msg:'AI 가 답을 만들지 못했습니다' }, 502);

    let out; try{ out = JSON.parse(txt); }catch(e){ return send({ ok:false, error:'bad-out' }, 502); }
    if(!out || !Array.isArray(out.items) || !out.items.length)
      return send({ ok:false, error:'bad-out', msg:'일정을 만들지 못했습니다' }, 502);

    return send({ ok:true, model:MODEL, out, usage:j.usage || null });
  }catch(e){
    const m = String((e && e.message) || e);
    const to = /abort|timeout/i.test(m);
    return send({ ok:false, error: to ? 'timeout' : 'server',
                  msg: to ? 'AI 응답이 너무 오래 걸렸습니다 — 다시 시도해 주세요' : m }, to ? 504 : 500);
  }
}
