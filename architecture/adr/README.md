# Architecture Decision Records

루트 `docs/`는 비공개·gitignore 경로이므로 ADR은 Git으로 추적되는 `architecture/adr/`에 둔다. [전체 문서 안내](../README.md).

이번 기록일은 **2026-11-02 KST**다. 기존 결정들을 현재 코드·규칙·Git 이력에서 소급 정리했다. 번호는 정리 순서이며 실제 결정 날짜 순서를 뜻하지 않는다. 최초 결정일을 추정하지 않으며, 아래 이유는 명시된 규칙과 구현상 제약에 근거한다. 별도 비교 실험이나 고객 검증을 수행했다는 뜻은 아니다.

| ADR | 결정 | 상태 |
| --- | --- | --- |
| [0001](0001-service-boundaries.md) | Next.js가 앱과 모델 작업, Python이 계산을 소유 | superseded by ADR-0009 |
| [0002](0002-local-project-persistence.md) | 로컬 SQLite를 프로젝트·자산 정본으로 사용 | accepted |
| [0003](0003-evidence-and-spatial-contracts.md) | 원본 근거·공간 편집 모델·엔진 계약 분리 | superseded by ADR-0009 |
| [0004](0004-reviewed-design-proposals.md) | 요청 단위 모델 작업과 명시적 공간 변경 적용 | accepted |
| [0005](0005-design-studio-scope.md) | 단일 제작 흐름 유지, 참가 플랫폼은 보류 | accepted |
| [0006](0006-session-only-planning-output.md) | 세션 캡처 기반 일회성 기획서 출력 | superseded by ADR-0007 |
| [0007](0007-persistent-planning-artifacts.md) | 도면별 영속 기획 문서와 파생 PDF 출력 | accepted |
| [0008](0008-retire-layout-engine.md) | 기존 배치 최적화·검증·동선 계산 제거 | accepted |
| [0009](0009-nextjs-document-preparation.md) | Next.js 문서 준비·Meta Model 해석으로 Python 제거 | accepted |

## 읽고 갱신하기

`accepted`는 현재 채택된 결정, `proposed`는 검토 중, `deprecated`는 더 이상 권장하지 않는 결정이다. `superseded by ADR-NNNN`은 대체 문서가 있음을 뜻한다. 새 결정에는 다음 번호를 쓰고, 맥락·선택·이유를 먼저 짧게 적는다. 영향·제약·코드 근거·재검토 조건은 필요할 때 덧붙인다.

과거 방식을 현재 권장사항처럼 남기지 않는다. 예를 들어 기획서가 패널을 닫으면 사라진다는 설명은 0006의 과거 동작이고, 현재 기획 문서의 저장/출력 정책은 0007이다. 관련 README와 UI 명세도 같은 변경에서 맞춘다.

