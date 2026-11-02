---
status: superseded by ADR-0013 for design
recorded: 2026-11-02
---
# 모델의 공간 변경은 검토된 제안으로 반환하고 사용자가 적용한다

현재 변경: [ADR-0013](0013-atomic-muse-operations.md)이 공간 설계의 제안·Apply를 operation 단위 즉시 커밋으로 대체했다. 선 검토 결과는 아래 결정대로 제안·Apply다.

자연어 요청이나 생성 중간 상태를 곧바로 프로젝트 변경으로 취급하면 실패·취소·오해를 되돌리기 어렵다. 서버가 의도를 검증하여 작업을 분기하고, 공간 설계는 요청별 초안·기하 검사·시각 검토를 거친 제안으로 반환한다. 프로젝트의 공간 변경은 사용자의 Apply에서 수행한다.

## 영향과 제약

- 모호한 의도는 확인을 요청하고, 모델 실패를 임의의 공간 변경으로 대체하지 않는다.
- 초안 수정과 검토는 동일한 요청별 작업에서 진행한다. 제출은 마지막 시각 검토된 리비전을 참조하며 다시 생성한 기하를 제출하지 않는다.
- Live draft와 Muvi 작업 동작은 임시 표시다. 자동 저장·실행 성공·검증 완료의 증거가 아니다.
- 도면이나 참고 자료가 바뀌면 오래된 제안을 그대로 적용하지 않는다.
- 결정적 기하 검사, 요구 항목의 존재 확인, 모델의 시각 판단, 사람의 승인 의미를 구별한다. 테스트의 모델 응답 fixture는 실제 모델 품질의 측정이 아니다.
- 기획 문서의 텍스트 수정과 사진 요청은 별도 문서 흐름이다([0007](0007-persistent-planning-artifacts.md)). 문서 편집을 공간 Apply 규칙과 혼동하지 않는다.
- 재시작 후 작업 복구나 장시간 협업이 필요해지면 [0001](0001-service-boundaries.md)의 실행 경계를 재검토한다.

근거: [의도 라우팅](../../web/server/plans/intent.ts), [설계 서비스](../../web/server/plans/design.ts), [Studio 대화](../../web/components/studio/studio-chat.tsx), [도구 계약](../../web/documentation/designer-muse-tools.md), [설계 루프 테스트](../../web/tests/designer-loop.test.ts).

