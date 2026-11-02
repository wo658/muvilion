# 샘플 도면

muvilion 스튜디오에 바로 올릴 수 있는 공개 전시장 도면(PDF, JPG, 2026-10-28 각 시설 공식 페이지에서 받음)과, 데모용으로 직접 그린 작은 가상 공간 도면(PNG)을 모았다.

> **저작권**: 모두 각 시설(LVCVA, KINTEX, Moscone Center/ASM Global 등)의 저작물이며, 출처를 밝혀 개발·테스트용으로 포함했다.
> 레포를 공개 배포하기 전에 원본 재배포가 괜찮은지 다시 확인하고, 필요하면 원본을 빼고 출처 링크와 내려받기 스크립트만 남긴다.

## 한눈에 비교

| | LVCC | KINTEX | Moscone |
|---|---|---|---|
| 형식 | PDF (벡터) | JPG (래스터) | PDF (벡터) |
| 축척 | ❌ 없음 ("not to scale") | ✅ 치수(m) 표기 | ✅ 축척 막대 (0–15m) |
| 현재 판독 | Muse 이미지 해석 | Muse 이미지 해석 | Muse 이미지 해석 |
| 최신성 | 2024.12 | 현재 사이트 이미지 | 2024 |
| 추천 용도 | 멀티 홀 구성, 축척 역산 테스트 | 국내 데모, 치수 검증 | **축척 정확한 메인 데모** |

CAD도 있다: Moscone은 층별 DWG(2026년), KINTEX는 CAD zip(2005–2007년). muvilion은 **DWG를 바로 받지 못해서** 이 폴더에는 넣지 않았다. 필요하면 아래 출처 페이지에서 받아 ASCII DXF로 바꾼 뒤 올린다 ([ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) 또는 LibreDWG `dwg2dxf`).

---

## popup/ — 성수 팝업 스튜디오 (직접 작성한 가상 공간)

| 파일 | 출처 | 설명 |
|---|---|---|
| `seongsu-popup-plan.png` | 이 저장소에서 작성 · [`web/scripts/build-sample-popup.mjs`](../../web/scripts/build-sample-popup.mjs)로 생성 | 1층 평면, 약 32 × 22 m (약 440㎡), 1580×1320 |

- 👍 **실제 건물이 아닌 오리지널 도면**이다. 외부 저작물을 쓰지 않아 재배포 조건 문제가 없다. 수정할 때는 스크립트를 고친 뒤 `web/`에서 `node scripts/build-sample-popup.mjs`로 다시 만든다.
- 👍 한눈에 들어오는 크기에 네모가 아닌 형태다: 사선으로 꺾인 정문 모서리, 남서쪽이 파인 L자 바닥, 화장실 코어와 창고, 철거할 수 없는 기둥 3개, 남쪽 서비스 도어.
- 👍 축척 막대(0–10 m)와 각 변의 치수(26 m, 16 m, 18 m, 15 m)가 적혀 있어 Muse가 축척을 확정할 수 있다. 벽은 굵은 실선, 치수선은 가는 회색 선이라 서로 구분된다.
- 👎 가상의 공간이라 실제 소방·구조 조건이나 천장고 정보가 없다. 치수는 설계 연습용 가정이다.

## lvcc/ — Las Vegas Convention Center (CES 개최지)

| 파일 | 출처 | 설명 |
|---|---|---|
| `lvcc-brochure-2024-12.pdf` | [LVCVA 시설 브로셔 2024.12](https://assets.simpleviewcms.com/simpleview/image/upload/v1/clients/lasvegas/LVCC_Brochure_Dec2024_d0ac51c8-e5c1-498b-8c80-7f19d7228e0e.pdf) | 19쪽. 도면은 4–15쪽 (아래) |
| `ahr-expo-2026-booth-layout.pdf` | [AHR Expo 2026 (ASHRAE)](https://www.ashrae.org/file%20library/technical%20resources/ashrae%20journal/2026-ahr-expo-las-vegas-floor-plan.pdf) | 4쪽. 같은 LVCC 홀에 **실제 부스를 배치한 행사 도면** (부스 번호·크기·통로) |

브로셔 쪽 안내: 4 캠퍼스 전체 · 5–6 전시홀 정보표 · 7 South Hall · 8 Central & North L1 · 9–10 North L2 · 11 South L2 · **12 West Hall L1&2 + 회의실 치수표** · 13 West L2 · 14 West L3 · 15 화물·롤업 도어

- 원본은 벡터 PDF다. 현재 경로에서는 페이지를 이미지로 렌더링한 뒤 Muse가 직접 해석하며, 벡터 선을 추출하지 않는다.
- 👍 홀 면적(ft²)·천장고·회의실 치수 표가 있어 축척을 거꾸로 계산할 수 있다.
- 👎 **축척이 없다** → 회의실 치수(W101 = 51'×42')나 홀 면적으로 직접 맞춰야 한다.
- 👎 한 쪽에 평면도·범례·표가 같이 있어서 **필요한 부분만 잘라내야(crop)** 한다. 아이콘·글자 외곽선도 선으로 잡힌다.
- 👎 CAD는 공개되지 않는다.
- 과거 벡터 추출 경로의 무키 테스트 결과(바닥 면적 −5.4%)는 현재 Muse 판독의 정확도를 나타내지 않는다.

## kintex/ — KINTEX (고양)

| 파일 | 출처 | 설명 |
|---|---|---|
| `kintex-halls1-5-overview.jpg` | [KINTEX 전시시설](https://www.kintex.com/web/en/html/facility/exhibition_facility_01.do) | 1~5홀 전체 배치 |
| `kintex-hall1~5-layout.jpg` | 같은 페이지의 홀별 LAYOUT | 홀별 평면 (1198×915) |

- 👍 이미지가 깔끔하고 **치수(m)가 적혀 있다**: 1홀(1A+1B) 171m × 63m, 기둥 Ø2.5m, 화물 반입구 5.7×5.4m / 8×6m. 축척 확인이 쉽다.
- 👍 기둥·입구·화물 반입구·소화전·화장실이 표시돼 제약 조건 테스트에 좋다.
- 👍 국내 전시장이라 한국어 데모에 맞다.
- 👎 원본 해상도가 1198×915로 작아 Muse가 작은 글자나 복잡한 구조를 모두 읽지 못할 수 있다. 원본과 함께 확인한다.
- 참고: [CAD zip](https://www.kintex.com/download/1exhibition/KINTEX_cad.zip)은 2005–2007년 DWG라 현재 건물과 다를 수 있다.

## moscone/ — Moscone Center (샌프란시스코)

| 파일 | 층 · 용도 | 출처 페이지 (PDF·DWG) |
|---|---|---|
| `west-L1.pdf` | West L1 · 전시홀 96,660 ft², 부스 최대 500 | [링크](https://moscone.com/floorplans/moscone-west-level-1-floor-plans) |
| `west-L2.pdf` | West L2 · 세션룸 2000–2024 | [링크](https://moscone.com/floorplans/moscone-west-level-2-floor-plan) |
| `west-L3.pdf` | West L3 · 기둥 없는 볼룸 56,000 ft² | [링크](https://moscone.com/floorplans/moscone-west-level-3-floor-plan) |
| `northsouth-exhibit.pdf` | North/South 전시층 · Hall A·B·C 약 244,000 ft² | [링크](https://moscone.com/floorplans/moscone-northsouth-exhibit-level-floor-plan) |
| `northsouth-lobby.pdf` | North/South 로비 · 등록 데스크 | [링크](https://moscone.com/floorplans/moscone-north-south-lobby-level-floor-plan) |
| `south-upper-mezz.pdf` | South 상층 · Esplanade Ballroom, 키노트 최대 4,800 | [링크](https://moscone.com/floorplans/moscone-south-upper-mezzanine-level-floor-plan) |
| `south-L3.pdf` | South L3 · 회의실 301–314 + 테라스 | [링크](https://moscone.com/floorplans/moscone-south-level-3-floor-plan) |

- 👍 도면에 **축척 막대와 바닥 하중(psf)**이 있다. 출처 페이지에서 같은 층의 **DWG(2026년)**도 받을 수 있다.
- 👍 층마다 용도가 달라 "행사 전체 공간 설계" 데모에 맞다 (West L1 전시 + South 볼룸 키노트 + 로비 등록).
- 👍 [소방 도면 요건](https://moscone.com/fire-marshal-floor-plan-requirements-exhibits) 공개 (부스 열 사이 통로 최소 10').
- ⚠️ 도면마다 축척이 다르다 ("reproduced at various scales"). PDF가 5–10쪽 세트라 페이지를 골라야 하고, 일부 페이지는 90° 돌아가 있다.

## 프로젝트 단위로 열기

`samples.json`이 유일한 샘플 목록이다. 시작 화면에서 성수 팝업(1개), KINTEX(6개), Moscone Center(7개), LVCC(2개) 프로젝트를 선택하면 포함된 원본을 복사하고 지정된 페이지를 이미지로 준비한 뒤 Meta Model(Muse)이 벽·텍스트·축척 근거를 실시간으로 읽는다(4장씩 동시, Moscone 약 2분). 실측 크기 근거는 Moscone 축척 막대, KINTEX 치수선, LVCC 브로셔 홀 면적이며 AHR 배치도와 Moscone North/South 전시층은 근거를 찾지 못해 크기를 직접 입력해야 한다. 각 도면은 독립 작업 화면으로 저장되며 헤더에서 전환한다. 이는 사전 디자인 결과나 시뮬레이션 재생이 아니다. 원본이 하나라도 없으면 해당 묶음은 제공하지 않으며, 추출 실패 시 일부만 담긴 프로젝트를 생성하지 않는다. 기존 사용자 프로젝트는 변경하지 않는다.

모든 도면은 Next.js에서 원본 페이지를 이미지로 준비하고, API 키가 있으면 Meta Model이 벽과 문자를 읽는다. Python·OpenCV·벡터 선 추출은 사용하지 않는다. 키가 없으면 원본 미리보기만 제공하며 실제 치수는 사용자가 확인한다. `rasterPdf` 분기는 제거했다.

## Meta 서비스 기반 기획 자료

각 샘플은 도면 묶음과 함께 선택된 기획서 1개, 브랜드 URL·설명 2개를 불러온다.

| 샘플 | 가상 기획 | 브랜드 참고 |
|---|---|---|
| 성수 팝업 | 써 보고·찍고·보내는 AI 글래스 팝업: 착용 피팅·촬영 산책·리스닝 라운지·핸즈프리 메시지 시연 | [Ray-Ban Meta](https://www.meta.com/ai-glasses/ray-ban-meta/), [Messenger](https://www.messenger.com/) |
| KINTEX | 크리에이터 커넥션 데이: 촬영·편집·대화·토크 | [Instagram](https://www.meta.com/instagram/), [Threads](https://www.threads.com/) |
| Moscone | 커뮤니티 & 비즈니스 허브: 워크숍·메시징 시연·상담 | [Facebook](https://www.meta.com/facebook-app/), [WhatsApp](https://www.whatsapp.com/) |
| LVCC | 몰입형 플레이 & AI 스튜디오: VR·혼합현실 체험·AI 아이디어 시연 | [Meta Quest](https://www.meta.com/quest/), [Meta AI](https://ai.meta.com/meta-ai/) |

기획은 2026-10-31에 공식 서비스 소개를 참고하여 독자 작성했다(성수 팝업은 2026-11-03). 성수 팝업은 공간도 가상이며, 브랜드 자료가 있으므로 새 프로젝트를 만들면 Muse가 첫 인테리어를 자동으로 만든다(ADR-0012). Meta의 공식 행사·의뢰·제휴나 공식 브랜드 가이드가 아니다. 외부 로고·사진·페이지 원문을 새로 번들하지 않는다. Threads의 텍스트·공개 대화 성격은 [공식 소개](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/)를, 현재 도메인은 [threads.com 이전 발표](https://about.fb.com/news/2025/04/new-features-threads-web-experience/)를 참고했다.

`samples.json`의 `sources`가 기획서와 브랜드 자료의 정본이다. 기획서는 공간 프로그램, 설계 연습용 가구·시설 수량, 체험 흐름, 도면별 활용 및 설계 요청 예시를 담는다. 새 프로젝트를 만들 때 본문을 UTF-8 `.txt` 원본으로 SQLite에 함께 저장하므로 프로젝트 내보내기에도 포함된다. 브랜드 URL은 북마크이며 생성 시 웹페이지를 수집하지 않는다. 함께 제공된 설명과 기획만 모델의 참고 자료가 된다.

도면 읽기는 키가 있을 때 Meta Model을 실제 호출하며, 키가 없으면 원본 미리보기만 표시한다. 공간 배치 결과, 기록된 재생, 모의 시뮬레이션 또는 라이브 VR·AI 체험 결과는 미리 채우지 않는다. 기획의 수량·운영 방향은 가정이며 축척·사용 영역·시설 연결·안전 조건은 실제 설계 전에 확인한다. 기존 SQLite 프로젝트는 덮어쓰지 않는다. 최신 자료는 시작 화면에서 새 샘플 프로젝트를 생성하면 적용된다.

## 기획 이미지와 구체적인 서비스 참고 (2026-11-02)

각 프로젝트에 디자인 콘셉트 이미지 1개와 공식 기사 참고 1개를 추가했다. 모두 기본 선택되며 Muse는 이미지 자체와 작성한 설명을 함께 읽는다. 새 샘플을 만들면 이미지가 SQLite 프로젝트에 저장되고 내보내기에도 포함된다. 기존 프로젝트는 변경하지 않는다.

| 프로젝트 | 독자 생성 기획 이미지 | 공식 참고 링크 |
|---|---|---|
| 성수 팝업 | `concepts/glasses-fitting-bar.webp` — 거울 3장·우드 트레이·스툴이 있는 피팅 카운터 (직접 그림, 아래 참고) | [Ray-Ban Meta 한국 출시](https://about.fb.com/news/2026/05/ray-ban-meta-and-oakley-meta-officially-launch-in-korea/) |
| KINTEX | `concepts/creator-display-pod.webp` — 아치형 촬영·전시 포드 | [Edits 소개](https://about.fb.com/news/2025/04/introducing-edits-streamlined-video-creation-app/) |
| Moscone | `concepts/conversation-counter.webp` — 상담·대화 시연 카운터 | [WhatsApp 비즈니스 대화 운영](https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/) |
| LVCC | `concepts/immersive-demo-pedestal.webp` — 장비 체험 받침대 | [Meta Quest 3S 소개](https://about.fb.com/news/2024/09/meta-quest-3s-our-most-affordable-mixed-reality-headset/) |

이미지는 2026-11-02 이 프로젝트를 위해 imagegen으로 생성한 신규 콘셉트다. 입력 참조 이미지 없이 작성한 프롬프트를 사용했으며 외부 제품·브랜드 사진, 로고, 공식 가이드 도형은 사용하지 않았다. 타사 원본의 재배포 조건에 의존하는 자산이 아니다. 생성물의 법적 독점권을 주장하지 않는다. 단색 배경에서 하나의 전시 가구가 전부 보이는 3/4 시점, 재료가 읽히는 조명, 글자·로고·사람 없는 구성을 공통으로 지정했다. 개별 디자인 지시는 각각 (1) 보라 아치 배경판+코럴 받침+일체형 선반, (2) 목재 상판+녹색 리브 전면+청색 측면 카운터, (3) 청색 기둥+아이보리 장비 트레이+낮은 넓은 받침이다. 원본 생성 PNG를 1024px 이내 WebP 품질 86으로 정규화했다.

성수 팝업의 콘셉트 이미지는 이미지 생성 모델이 아니라 [`web/scripts/build-sample-popup.mjs`](../../web/scripts/build-sample-popup.mjs)의 SVG 아이소메트릭 도형으로 2026-11-03에 직접 그려 1024×768 WebP 품질 86으로 저장했다. 같은 공통 지시(가구 하나, 3/4 시점, 단색 배경, 글자·로고·사람 없음)를 따랐다.

이는 실제 설치 사례나 3D 복원 결과가 아닌 **디자인 입력 자료**다. 본문의 폭은 기획 가정이며 이미지에서 측정한 값이 아니다. Muse는 지원되는 공간 요소로 형태·색상·재료를 해석할 수 있지만 이미지의 세부 곡면이나 제작 구조를 그대로 구현했다고 주장하면 안 된다. 공식 기사 링크는 문맥 파악용 북마크로만 저장하고, 기사 이미지·로고·원문을 재배포하지 않는다.

매니페스트의 `imageFiles`는 샘플 디렉터리 하위의 PNG/JPEG/WebP 파일을 참조한다. 누락된 이미지를 가진 샘플은 목록에서 제외하며, 잘못된 이미지 헤더 또는 이미지당 449,000바이트를 넘는 자료는 프로젝트 생성 전에 거절한다. 생성 후 파일 경로는 프로젝트 상태에 들어가지 않고 기존 `source.images` 데이터로 보존된다.
