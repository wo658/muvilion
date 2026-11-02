---
status: accepted
recorded: 2026-11-02
---
# 업로드 PDF의 벽은 Muse가 페이지 이미지에서 추적한다

현재 목표는 실측 재현이 아니라 데모 수준의 빠른 3D 콘셉트다. 엔진이 추출한 미분류 선을 사용자가 일일이 분류하는 대신, 사용자가 업로드한 PDF는 엔진이 페이지를 렌더링한 뒤 Muse가 이미지와 텍스트 위치를 보고 벽 선분을 직접 제안한다. 이 결정은 [ADR-0003](0003-evidence-and-spatial-contracts.md)의 "추출 선은 미분류로 시작" 원칙에 대한 업로드 PDF 예외다. 이미지·DXF·샘플 프로젝트는 기존 엔진 추출을 유지한다.

## 영향과 제약

- Muse 선은 `origin: "ai"`, `kind: "wall"`, `method: "muse"`로 표시하고 근사치 경고를 붙인다. 확인된 건축 구조나 실측 치수가 아니다.
- Muse가 추정한 가로·세로 미터는 `scaleConfirmed: false`로 둔다. 축척 확인은 계속 사용자가 한다.
- 선이 너무 많아 엔진이 거부한 PDF(413)는 래스터 모드로 다시 추출한다. Muse 호출은 예산 안에서 한 번 재시도하고, 실패하면 엔진 선과 경고로 돌아간다. 실패 이유는 서버 로그에 남긴다.
- 모델 호출은 Next.js가 소유한다([ADR-0001](0001-service-boundaries.md)). Python은 렌더링과 추출만 하며 모델을 호출하지 않는다.
- 좌표 정확도가 필요해지면 Muse 선을 엔진 추출 선에 맞추거나, 미분류 선 검토 흐름으로 되돌리는 방안을 다시 결정한다.

근거: [추출·추적 서비스](../../web/server/plans/extract.ts), [Muse 추적 호출](../../web/server/plans/trace.ts), [추적 결과 반영](../../web/lib/plans/trace.ts), [회귀 테스트](../../web/tests/plan-trace.test.ts). 관련 이력: `3c5258e`.
