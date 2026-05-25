# 일정 JSON 파일 작성법

이 문서는 **📂 JSON 불러오기** (상단 툴바) 또는 저장 모달의 **📤 JSON 가져오기** 버튼으로 불러올 수 있는 일정 JSON 파일의 형식을 설명합니다.

## 빠른 시작

1. 현재 일정을 **💾 저장 → 📥 JSON 다운로드** 로 내려받기
2. 받은 파일을 텍스트 에디터로 열어 구조 확인
3. 원하는 대로 수정 후 저장
4. **📂 JSON 불러오기** 로 다시 적재 → 자동으로 화면 갱신

> 누락된 필드는 가져올 때 자동으로 기본값이 채워지므로, 필수 항목만 갖춰도 동작합니다.

---

## 최상위 구조

```json
{
  "type": "italy-trip-itinerary",
  "version": 1,
  "exportedAt": "2026-05-25T12:34:56.000Z",
  "cities": [ /* 도시 객체 배열 */ ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `type` | string | ✕ | 식별용 태그. 보통 `"italy-trip-itinerary"`. |
| `version` | number | ✕ | 스키마 버전. 현재 `1`. |
| `exportedAt` | string (ISO 8601) | ✕ | 내보낸 시각. 정보용. |
| `cities` | array | ✅ | **도시 객체의 배열. 비어 있으면 안 됨.** |

---

## 도시 객체 (`cities[]`)

```json
{
  "id": "roma",
  "order": 1,
  "type": "base",
  "emoji": "🏛️",
  "name": "Roma",
  "ko": "로마",
  "lat": 41.9028,
  "lng": 12.4964,
  "nights": "4박",
  "day": "Day 1~4",
  "title": "Antica Roma · 영원의 도시",
  "subtitle": "여행의 시작점",
  "tip": "숙소는 테르미니~스페인광장 사이가 동선상 가장 편해요.",
  "warn": "",
  "transitToNext": { "mode": "train", "duration": 90, "note": "Frecciarossa 직행" },
  "days": [ /* 일자 객체 배열 */ ]
}
```

| 필드 | 타입 | 필수 | 기본값 / 비고 |
|---|---|---|---|
| `id` | string | ✕ | 고유 식별자. 없으면 자동 생성. 다른 도시와 겹치지 않게 작성. |
| `order` | number | ✕ | 표시 순서. 없으면 배열 인덱스 + 1. |
| `type` | `"base"` \| `"day"` \| `"alpine"` | ✕ | `base` = 숙박 도시 (기본), `day` = 당일치기, `alpine` = 알프스/산악. |
| `emoji` | string | ✕ | 사이드바·지도에 표시되는 아이콘. |
| `name` | string | ✅ | 영문/현지명 (지도 검색용). 없으면 `ko` 사용. |
| `ko` | string | ✕ | 한국어 표기. UI 라벨에 사용. |
| `lat`, `lng` | number | ⭐ 권장 | 도시 중심 좌표. 없으면 지도에서 위치 표시 불가. |
| `nights` | string | ✕ | "4박", "당일치기" 등 자유 문자열. |
| `day` | string | ✕ | "Day 1~4" 등 표시용 라벨. |
| `title` | string | ✕ | 상세 화면 큰 제목. |
| `subtitle` | string | ✕ | 상세 화면 부제. |
| `tip` | string | ✕ | 도시별 팁 (사이드바). |
| `warn` | string | ✕ | 주의사항. |
| `transitToNext` | object | ✕ | 이 도시 → **다음 base 도시** 이동수단. [아래 참조](#도시간-이동-transittonext). |
| `days` | array | ✅ | 일자 객체 배열 (없으면 빈 배열). |

### 도시간 이동 (`transitToNext`)

```json
{
  "mode": "train",
  "duration": 90,
  "note": "Frecciarossa 직행 · 약 1시간 30분"
}
```

- `mode`: `"walk" | "metro" | "bus" | "taxi" | "train" | "flight" | "car" | "ferry"` 중 하나
- `duration`: 분 단위 정수
- `note`: 자유 메모

> **참고**: `transitToNext`는 해당 도시 마지막 날의 마지막 일정 직후에 자동으로 transit 아이템으로 미러링됩니다. 둘 중 한 곳만 작성해도 양쪽에 반영됩니다.

---

## 일자 객체 (`cities[].days[]`)

```json
{
  "dayNum": 1,
  "date": "12/19 (금)",
  "title": "Day 1 · 로마 도착",
  "items": [ /* 일정 아이템 배열 */ ]
}
```

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `dayNum` | number | ✕ | 도시 내 N번째 날. 없으면 인덱스 + 1. |
| `date` | string | ✕ | "12/19 (금)" 등 자유 형식 표시용. |
| `title` | string | ✕ | "Day 1 · 로마 도착" 등 헤더. |
| `items` | array | ✅ | 일정 아이템 배열. 빈 배열이면 시스템이 기본 항목(숙소/식사)을 자동 추가. |

---

## 일정 아이템 (`days[].items[]`)

일정 아이템은 **장소형(tour/hotel/food/airport)** 과 **교통형(transit)** 두 가지 모양으로 나뉩니다.

### A) 장소형 아이템

```json
{
  "id": "p_colosseo",
  "name": "콜로세움",
  "category": "tour",
  "lat": 41.8902,
  "lng": 12.4922,
  "address": "Piazza del Colosseo, 1, 00184 Roma RM, Italy",
  "rating": 4.7,
  "reviewCount": 432000,
  "startTime": "09:00",
  "duration": 120,
  "description": "고대 로마의 상징. 예약 필수.",
  "transitTo": { "mode": "walk", "duration": 12 }
}
```

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `id` | string | ✕ | 고유 ID. 없으면 자동 생성. |
| `name` | string | ✅ | 표시 이름. |
| `category` | `"tour" \| "mytour" \| "hotel" \| "food" \| "airport"` | ✅ | `tour`=🎫관광지, `mytour`=🧭마이리얼트립 투어, `hotel`=🏨숙소, `food`=🍽️식당, `airport`=✈️공항. 누락 시 `tour`로 처리. |
| `lat`, `lng` | number | ⭐ 권장 | 지도 표시 좌표. 없으면 지도에 점이 안 찍힘. |
| `address` | string | ✕ | 주소. |
| `rating` | number | ✕ | 별점 (0~5). |
| `reviewCount` | number | ✕ | 리뷰 수. |
| `startTime` | string `"HH:MM"` | ✕ | 시작 시각. 없으면 직전 아이템 종료시간 기준으로 자동 계산. |
| `duration` | number | ✅ | 소요시간(분). 누락 시 `60`. |
| `description` | string | ✕ | 메모/설명. |
| `transitTo` | object | ✕ | **다음 아이템까지의 이동수단.** [아래 참조](#아이템간-이동-transitto). |
| `placeholder` | boolean | ✕ | `true`면 "기본 슬롯"으로 표시 (이름을 비워두고 자리만 잡는 용도). |

#### 아이템간 이동 (`transitTo`)

```json
{ "mode": "walk", "duration": 10 }
{ "mode": "metro", "duration": 25, "manual": true }
{ "mode": "walk", "duration": 0, "pending": true }
```

- `mode`: 위 도시간 이동과 동일한 값
- `duration`: 분 단위
- `manual`: `true`면 사용자가 직접 지정 → 자동 재계산 대상에서 제외
- `pending`: `true`면 "AI가 추천 중..." 상태 (보통 직접 작성할 필요 없음)

### A-1) 마이리얼트립 투어 (`category: "mytour"`)

장소형 아이템의 변형. 다음 추가 필드를 사용합니다.

```json
{
  "id": "mytour_rome_colosseo",
  "name": "로마 콜로세움 입장권 + 한국어 가이드 투어",
  "category": "mytour",
  "cityLabel": "로마",
  "mytripUrl": "https://experiences.myrealtrip.com/products/3440846",
  "lat": 41.8902,
  "lng": 12.4922,
  "startTime": "09:00",
  "duration": 180,
  "description": "마이리얼트립 예약 투어"
}
```

| 필드 | 비고 |
|---|---|
| `category` | 반드시 `"mytour"` |
| `mytripUrl` | **마이리얼트립 상품 URL** (`https://experiences.myrealtrip.com/products/...`). 우측 사이드패널에서 이 URL의 Open Graph 메타·이미지·JSON-LD를 가져와 미리보기로 표시합니다. |
| `cityLabel` | 도시 표시명 (예: "로마") |
| 기타 (`lat`, `lng`, `duration`, `startTime`, `description`) | 일반 장소형과 동일 |

> 우측 패널 미리보기는 CORS 프록시(`corsproxy.io` → `allorigins.win`)를 통해 페이지 HTML을 가져와 클라이언트에서 파싱합니다. 프록시가 일시적으로 차단될 경우 미리보기는 실패하지만 일정 등록과 링크 열람은 그대로 동작합니다.

### B) 교통형 아이템 (transit)

도시 간 이동 또는 도시 내 장거리 이동을 별도 일정으로 표시할 때 사용합니다.

```json
{
  "id": "transit_roma_firenze",
  "name": "로마 → 피렌체",
  "category": "transit",
  "fromName": "로마 테르미니역",
  "fromLat": 41.9009,
  "fromLng": 12.5018,
  "toName": "피렌체 SMN역",
  "toLat": 43.7765,
  "toLng": 11.2480,
  "lat": 43.7765,
  "lng": 11.2480,
  "transitMode": "train",
  "transitNote": "Frecciarossa 9519 · 09:30 출발",
  "duration": 95,
  "startTime": "09:00",
  "address": "Piazza della Stazione, Firenze",
  "description": "고속열차 · 약 1시간 35분"
}
```

| 필드 | 비고 |
|---|---|
| `category` | 반드시 `"transit"` |
| `fromName`, `fromLat`, `fromLng` | 출발지 정보 |
| `toName`, `toLat`, `toLng` | 도착지 정보 |
| `lat`, `lng` | 보통 도착지와 동일하게 설정 (지도 표시 기준점) |
| `transitMode` | `walk / metro / bus / taxi / train / flight / car / ferry` |
| `transitNote` | 노선·편명 등 자유 메모 |
| `duration`, `startTime` | 장소형과 동일 |

### C) 공항 아이템 (airport)

`category: "airport"` 인 장소형 아이템과 동일한 형태입니다. 도착/출국 슬롯에 자동 생성되며, 직접 작성할 때도 같은 필드를 사용합니다.

---

## 전체 예시 (최소 구성)

```json
{
  "type": "italy-trip-itinerary",
  "version": 1,
  "cities": [
    {
      "id": "roma",
      "order": 1,
      "type": "base",
      "emoji": "🏛️",
      "name": "Roma",
      "ko": "로마",
      "lat": 41.9028,
      "lng": 12.4964,
      "nights": "2박",
      "days": [
        {
          "dayNum": 1,
          "date": "12/19 (금)",
          "title": "Day 1 · 로마 도착",
          "items": [
            {
              "name": "콜로세움",
              "category": "tour",
              "lat": 41.8902,
              "lng": 12.4922,
              "startTime": "10:00",
              "duration": 120,
              "transitTo": { "mode": "walk", "duration": 10 }
            },
            {
              "name": "트라토리아 다 루이지",
              "category": "food",
              "lat": 41.8950,
              "lng": 12.4710,
              "startTime": "12:30",
              "duration": 75
            }
          ]
        }
      ],
      "transitToNext": { "mode": "train", "duration": 95, "note": "Frecciarossa" }
    },
    {
      "id": "firenze",
      "order": 2,
      "type": "base",
      "emoji": "🎨",
      "name": "Firenze",
      "ko": "피렌체",
      "lat": 43.7696,
      "lng": 11.2558,
      "nights": "1박",
      "days": [
        { "dayNum": 1, "date": "12/20 (토)", "title": "Day 2 · 피렌체", "items": [] }
      ]
    }
  ]
}
```

---

## 가져올 때 동작

- `cities`가 배열이 아니거나 비어 있으면 **불러오기 실패** 알림 후 중단.
- 각 도시/일자/아이템에 누락된 필수 필드는 **자동 보정**됩니다 (`id` 자동 생성, `category` → `tour`, `duration` → 60 등).
- 빈 `items` 배열을 가진 일자에는 도시 타입에 따라 **숙소/식사 기본 슬롯**이 자동으로 추가됩니다.
- 기존 localStorage 일정은 **완전히 대체**되므로, 안전을 위해 먼저 💾 저장으로 슬롯에 백업하는 것을 권장합니다.

---

## 자주 쓰는 카테고리/모드 값 요약

**`category`**: `tour` | `mytour` | `hotel` | `food` | `airport` | `transit`

**`mode` / `transitMode`**: `walk` | `metro` | `bus` | `taxi` | `train` | `flight` | `car` | `ferry`

**`type`** (도시): `base` (숙박) | `day` (당일치기) | `alpine` (산악)
