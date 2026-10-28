# 샘플 도면

muvilion 스튜디오에 바로 올릴 수 있는 공개 전시장 도면만 모았다 (PDF, JPG). 2026-10-28에 각 시설의 공식 페이지에서 받았다.

> **저작권**: 모두 각 시설(LVCVA, KINTEX, Moscone Center/ASM Global 등)의 저작물이며, 출처를 밝혀 개발·테스트용으로 포함했다.
> 레포를 공개 배포하기 전에 원본 재배포가 괜찮은지 다시 확인하고, 필요하면 원본을 빼고 출처 링크와 내려받기 스크립트만 남긴다.

## 한눈에 비교

| | LVCC | KINTEX | Moscone |
|---|---|---|---|
| 형식 | PDF (벡터) | JPG (래스터) | PDF (벡터) |
| 축척 | ❌ 없음 ("not to scale") | ✅ 치수(m) 표기 | ✅ 축척 막대 (0–15m) |
| 선 추출 | 정확 (PDF 벡터) | 추정 (OpenCV) | 정확 (PDF 벡터) |
| 최신성 | 2024.12 | 현재 사이트 이미지 | 2024 |
| 추천 용도 | 멀티 홀 구성, 축척 역산 테스트 | 국내 데모, 치수 검증 | **축척 정확한 메인 데모** |

CAD도 있다: Moscone은 층별 DWG(2026년), KINTEX는 CAD zip(2005–2007년). muvilion은 **DWG를 바로 받지 못해서** 이 폴더에는 넣지 않았다. 필요하면 아래 출처 페이지에서 받아 ASCII DXF로 바꾼 뒤 올린다 ([ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) 또는 LibreDWG `dwg2dxf`).

---

## lvcc/ — Las Vegas Convention Center (CES 개최지)

| 파일 | 출처 | 설명 |
|---|---|---|
| `lvcc-brochure-2024-12.pdf` | [LVCVA 시설 브로셔 2024.12](https://assets.simpleviewcms.com/simpleview/image/upload/v1/clients/lasvegas/LVCC_Brochure_Dec2024_d0ac51c8-e5c1-498b-8c80-7f19d7228e0e.pdf) | 19쪽. 도면은 4–15쪽 (아래) |
| `ahr-expo-2026-booth-layout.pdf` | [AHR Expo 2026 (ASHRAE)](https://www.ashrae.org/file%20library/technical%20resources/ashrae%20journal/2026-ahr-expo-las-vegas-floor-plan.pdf) | 4쪽. 같은 LVCC 홀에 **실제 부스를 배치한 행사 도면** (부스 번호·크기·통로) |

브로셔 쪽 안내: 4 캠퍼스 전체 · 5–6 전시홀 정보표 · 7 South Hall · 8 Central & North L1 · 9–10 North L2 · 11 South L2 · **12 West Hall L1&2 + 회의실 치수표** · 13 West L2 · 14 West L3 · 15 화물·롤업 도어

- 👍 도면이 **벡터 선**이라 엔진이 선을 그대로 뽑는다 (12쪽 → 선 7,540개, 0.7초).
- 👍 홀 면적(ft²)·천장고·회의실 치수 표가 있어 축척을 거꾸로 계산할 수 있다.
- 👎 **축척이 없다** → 회의실 치수(W101 = 51'×42')나 홀 면적으로 직접 맞춰야 한다.
- 👎 한 쪽에 평면도·범례·표가 같이 있어서 **필요한 부분만 잘라내야(crop)** 한다. 아이콘·글자 외곽선도 선으로 잡힌다.
- 👎 CAD는 공개되지 않는다.
- 테스트 기록: 12쪽 West Hall을 키 없이 3D까지 만들었고, 바닥 면적이 브로셔 대비 −5.4% (자세한 내용은 `docs/REFERENCES.md`).

## kintex/ — KINTEX (고양)

| 파일 | 출처 | 설명 |
|---|---|---|
| `kintex-halls1-5-overview.jpg` | [KINTEX 전시시설](https://www.kintex.com/web/en/html/facility/exhibition_facility_01.do) | 1~5홀 전체 배치 |
| `kintex-hall1~5-layout.jpg` | 같은 페이지의 홀별 LAYOUT | 홀별 평면 (1198×915) |

- 👍 이미지가 깔끔하고 **치수(m)가 적혀 있다**: 1홀(1A+1B) 171m × 63m, 기둥 Ø2.5m, 화물 반입구 5.7×5.4m / 8×6m. 축척 확인이 쉽다.
- 👍 기둥·입구·화물 반입구·소화전·화장실이 표시돼 제약 조건 테스트에 좋다.
- 👍 국내 전시장이라 한국어 데모에 맞다.
- 👎 JPG(래스터)라 OpenCV로 선을 추정한다 → 벡터 PDF보다 정확도가 낮다. 해상도도 1198×915로 작다.
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
