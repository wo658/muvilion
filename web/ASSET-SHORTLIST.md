# 공간 디자인용 CC0 에셋 선정 목록

확인일 및 다운로드일: 2026-10-28. 선정한 12종의 **1K 실제 파일을 `public/assets/cc0/`에 포함**했다. 재질은 웹용 JPG 맵을 추출했고 모델은 glTF + BIN + 참조 텍스처를 함께 저장했다. 아래 2K 링크는 고해상도 원본을 추가로 받을 때 사용한다. 로컬 파일 목록·출처·체크섬은 [manifest.json](public/assets/cc0/manifest.json), 사용 방법과 검증 범위는 [에셋 안내](public/assets/cc0/README.md)에 기록했다. Muse의 `search_design_assets` 도구로 검색해 디자인 제안에 포함할 수 있다. 사용자가 적용하면 3D 장면에서 모델과 재질을 불러온다. 실제 Muse 응답과 장면 렌더링을 확인했으며, 별도의 수동 에셋 선택 UI는 제공하지 않는다.

## 재질 — ambientCG 6종

아래 ZIP은 공식 페이지의 **2K-JPG** 다운로드 링크다. 가벼운 초기 검증에는 페이지에서 1K-JPG를 선택해도 된다. 실제 수령한 1K ZIP은 CRC 검사 후 필요한 맵만 추출했다. 2K 파일은 별도로 수령하지 않았다. 링크가 변경되면 개별 페이지에서 다시 받는다.

| 에셋 / 공식 페이지 | 앱에서 사용할 곳과 선정 이유 | 다운로드 | 선택 시 유의점 |
| --- | --- | --- | --- |
| [Plaster 001](https://ambientcg.com/view?id=Plaster001) | 흰 가벽·전시 배경. 무광의 흰 미장 질감 | [2K JPG ZIP](https://ambientcg.com/get?file=Plaster001_2K-JPG.zip) | 표면이 거친 stucco 계열이다. 매끈한 도장 가벽은 단색 재질을 기본으로 하고 이 재질은 옵션으로 사용 |
| [Concrete 034](https://ambientcg.com/view?id=Concrete034) | 전시장 바닥·기존 벽. 밝은 회색의 매끈한 콘크리트 | [2K JPG ZIP](https://ambientcg.com/get?file=Concrete034_2K-JPG.zip) | 공급처 반복 영역 약 1.1m × 0.55m. UV 반복 크기를 실제 치수에 맞출 것 |
| [Wood 051](https://ambientcg.com/view?id=Wood051) | 전시대·카운터·가구. 어둡고 매끈한 목재 | [2K JPG ZIP](https://ambientcg.com/get?file=Wood051_2K-JPG.zip) | 공급처 반복 영역 약 0.8m × 0.8m. 밝은 합판 대용으로 표현하지 않음 |
| [Metal 036](https://ambientcg.com/view?id=Metal036) | 가벽 프레임·가구 다리·조명 외장. 회색 금속 | [2K JPG ZIP](https://ambientcg.com/get?file=Metal036_2K-JPG.zip) | 금속감은 환경광과 roughness 설정에도 영향을 받으므로 앱에서 확인 |
| [Fabric 026](https://ambientcg.com/view?id=Fabric026) | 행사 포인트 구역·카펫 바닥. 붉은 직물/카펫 | [2K JPG ZIP](https://ambientcg.com/get?file=Fabric026_2K-JPG.zip) | 중성 패브릭이 아니라 빨간 카펫 옵션. 기본 바닥으로 일괄 적용하지 않음 |
| [Tiles 074](https://ambientcg.com/view?id=Tiles074) | 로비·라운지의 대리석 타일 바닥 | [2K JPG ZIP](https://ambientcg.com/get?file=Tiles074_2K-JPG.zip) | 공급처 반복 영역 약 2.1m × 2.1m. 타일 줄눈 크기를 유지 |

공급처/권리 근거: [ambientCG 공식 라이선스](https://docs.ambientcg.com/license/). 다운로드 에셋과 재질 미리보기 렌더는 CC0 1.0이며 상업적 사용, 수정, 재배포 및 프로젝트에 원본 파일 포함을 허용한다. 표시 의무는 없지만 추적을 위해 에셋 ID와 출처를 보존한다.

## 가구 — Poly Haven 3종

아래 링크는 **개별 에셋 다운로드 페이지**이며 ZIP 직링크가 아니다. 페이지에서 **1K 또는 2K → glTF → Download**를 선택한다. 현재 로컬 버전은 1K glTF이며 BIN·텍스처 참조 파일을 모두 포함한다. GLB 변환은 하지 않았다.

| 에셋 / 다운로드 페이지 | 앱에서 사용할 곳과 선정 이유 | 공급처 표시 복잡도 / 치수 | 도입 우선순위 |
| --- | --- | --- | --- |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | 상담·라운지 좌석. 목재 프레임과 검은 쿠션의 현대적 암체어 | 약 9K triangles / 높이 1m | 우선: 테이블과 함께 작은 라운지 세트로 검증 |
| [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) | 라운지 테이블. 석재 상판과 목재 프레임 | 약 5K triangles / 너비 1.2m | 우선: 상판 질감과 바닥 기준점 확인 |
| [Modular Street Seating](https://polyhaven.com/a/modular_street_seating) | 공용 휴게 구역·대기 벤치. 모듈형 좌석 | 약 25K triangles / 전체 너비 4.3m | 다음: 전체 세트 기준 치수이므로 단일 의자로 등록하지 않음. 실내 가구보다 공용/외부 공간 스타일 |

## 조명 — Poly Haven 3종

다운로드 방법은 가구와 같다. 조명 에셋은 **기구 외형 후보**다. emissive 재질, 실제 장면 광원, 배광/조도 계산을 구분한다. 아래 목록은 IES 측정 자료나 조명 시뮬레이션 검증을 포함하지 않는다.

| 에셋 / 다운로드 페이지 | 앱에서 사용할 곳과 선정 이유 | 공급처 표시 복잡도 / 치수 | 도입 우선순위 |
| --- | --- | --- | --- |
| [Modern Ceiling Lamp 01](https://polyhaven.com/a/modern_ceiling_lamp_01) | 라운지·상담 구역의 구형 펜던트. 흰 반투명 유리와 금속 피팅 | 약 6K triangles / 높이 1m | 우선: 천장 부착점과 빛의 위치를 별도 설정 |
| [Mounted Fluorescent Lights](https://polyhaven.com/a/mounted_fluorescent_lights) | 홀·작업 구역의 선형 조명. 회색 금속 외장과 발광 맵 | 약 18K triangles / 너비 0.9m | 다음: 반복 설치 시 모델 복제 비용과 실제 광원 수를 따로 관리 |
| [Desk Lamp Arm 01](https://polyhaven.com/a/desk_lamp_arm_01) | 접수대·데모 책상의 관절형 스탠드 | 약 26K triangles / 높이 0.9m | 보조: 작은 소품에 비해 복잡하므로 가까이 보는 테이블에 선별 사용 |

복잡도와 치수는 공식 페이지의 반올림된 표시값이며 앱에서 측정한 성능/충돌 치수가 아니다. 제공 형식은 glTF, Blend, USD, FBX 등이며 이 앱에는 glTF 경로를 권장한다.

공급처/권리 근거: [Poly Haven 공식 라이선스](https://polyhaven.com/license). 에셋은 CC0이며 상업적 사용·수정·재배포가 허용된다. 사이트의 문구·로고·예시 렌더까지 일괄 CC0로 취급하지 않는다. 앱 썸네일은 받은 모델로 직접 렌더하는 방식을 권장한다. 웹사이트/API 접근 약관은 에셋 라이선스와 별도이므로 대량 수집이나 실시간 API 연동은 이번 선정에 포함하지 않는다.

## 우리 앱 적용 순서

1. Concrete 034 + Wood 051 + Modern Arm Chair 01 + Modern Coffee Table 01 + Modern Ceiling Lamp 01을 첫 실사풍 라운지 조합으로 검증한다. 가벽은 치수 조절형 기본 형상을 유지하고, 매끈한 단색 마감 또는 Plaster 001을 선택하게 한다.
2. glTF 패키지의 텍스처와 메시를 함께 받아 GLB로 정리한다. 미터 단위, 방향, 바닥/천장 부착 기준점, 재질 슬롯, 바운딩 박스를 확인한다. 기존 배치·충돌 데이터와 장식용 모델을 구분한다.
3. 재질은 Base Color / Normal GL / Roughness를 우선 적용하고 Metalness·AO는 필요할 때 추가한다. displacement는 초기 웹 뷰어에서 기본 적용하지 않는다. 현재 포함한 맵 구성은 manifest.json에서 확인할 수 있다.
4. 반복 의자·조명은 리소스를 공유하고, 1K~2K부터 실제 장면으로 검증한다. 투명 유리와 그림자 비용은 별도로 확인한다. 위 triangle 수만으로 성능을 보장하지 않는다.
5. 포함한 파일의 공급처 ID·원본 페이지·다운로드 URL·다운로드 날짜·라이선스 근거·SHA-256을 manifest.json에 기록했다. 원본 바이트를 유지하며 맵 선택 추출 외 변환은 하지 않았다. 이 문서는 선정 목록이며 사용자 예제 카탈로그나 런타임 에셋 레지스트리를 대체하지 않는다.

직접 제작할 범위는 치수가 변하는 가벽·전시대·기본 레일/스폿 조명으로 제한하는 것을 제안한다. 외부 모델로 다양한 장식 형태를 확보하되, 치수 편집과 반복 배치가 핵심인 단순 형상은 앱에서 관리하는 편이 적합하다.
