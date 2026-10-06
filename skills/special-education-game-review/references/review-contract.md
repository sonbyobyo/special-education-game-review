# 입력·증거·판정 계약 v1

## 입력

학습게임·웹앱의 실제 제공 범위를 검수한다. 설계안, 소스, 브라우저 실행은 서로 다른 검수 범위이다. 모든 개인정보는 최소화하며 학생 이름·진단·IEP 원문을 양식에 넣지 않는다.

- target: name, artifact_kind(design_only/source_only/browser_only/mixed), entry(URL/로컬 경로 또는 null), version(모르면 unknown).
- learning_goals: id, text, status(confirmed/teacher_proposal/needs_confirmation). 공식 고시/IEP와 대조하지 못한 목표를 confirmed로 바꾸지 않는다. 교사 제안 목표를 검수할 수 있지만 그 지위를 유지한다.
- learner_context: confirmed_access_needs와 unknowns 배열. 요구만 기록하고 학생 식별 정보는 기록하지 않는다.
- features: [catalog.json](catalog.json)의 48개 기능. 각 값은 {state: present/absent/unknown, basis: 확인 근거 또는 빈 문자열}. present/absent에는 실제 확인 위치나 사용자가 지정한 범위를 적는다. 빠진 기능은 unknown이다. 검수자가 소스에서 못 찾았으면 부재가 아니라 unknown으로 둔다.
- scope_notes: 검수할 활동, 제외 범위, 제공 자료의 한계. 처음부터 종료까지 실제 수행하지 않았다면 이를 적는다.

init 명령이 완전한 입력 틀을 만든다. 기능은 전문용어 UI가 아니라 검수자의 내부 분류이다. 입력에 답하지 않은 선택을 자동 승인하지 않는다.

## 기능 분기

카탈로그 activation은 판정 대신 읽을 기준을 고르는 운영 규칙이다. any_features 중 하나라도 present이면 적용 후보, 모두 absent이면 입력 범위상 해당 없음 후보, 그 외에는 적용 미확정이다. always_screen은 항상 검토한다. 세부 적용 조건과 예외가 최종적으로 우선한다.

드래그가 있어도 경로 자체가 목표인 예외를 판단하려면 목표와 출처를 대조한다. 게임에 특정 버튼이 없다는 이유로 도움·쉬기·거절 수단을 해당 없음으로 건너뛰지 않는다. 기존 AAC·합의된 신호·교사 응답을 포함해 P01 적용을 확인한다. 창작 활동도 G03의 자료·관계·절차 정확성을 확인하되 유일 정답은 요구하지 않는다.

## 검수 결과 JSON

- schema_version: 1.0
- catalog_version: 1.0.0
- profile: 위 입력
- reviewed_environment: 실제로 검사한 환경 문자열 배열. 선언한 목표 기기와 구분한다.
- evidence: 관찰 기록 배열
- results: 56개 기준의 개별 결과. 해당 없음/미확인도 생략하지 않는다.
- limitations: 확인하지 못한 제품·학생·환경·표준 범위

증거 필드:

| 필드 | 의미 |
|---|---|
| id | 중복 없는 E01 등 ID |
| layer | declared/source/browser/device/learner/teacher/measurement/listening/export/rights |
| artifact | URL 또는 로컬 파일 경로. 로컬 상대경로는 결과 JSON 위치 기준 |
| location | 줄·절·선택자·실행 단계·파일/오디오 위치 |
| environment | 실제 환경과 도구. 해당 없는 문서 검토는 문서 검토라고 명시 |
| observed_at | 실제 확인 시점 ISO8601 |
| observation | 직접 확인한 사실. 해석과 후속 계획을 섞지 않는다 |

문헌 source_ids와 위 evidence는 다르다. sources.json을 링크하는 것만으로 제품 증거를 만들지 않는다. declared는 사용자 설명/주장에만 쓴다. 계획된 시험, 입력 기능 상태, 목표 기기 선언을 실제 실행 증거로 기록하지 않는다. teacher/learner는 실제로 제공받거나 수행된 관찰의 기록이며 모델이 관찰자를 대신 생성하지 않는다.

결과 필드:

| 필드 | 값/의미 |
|---|---|
| criterion_id | G01 등 카탈로그 ID |
| applicability | applicable/not_applicable/unknown |
| applicability_reason | 적용·비적용·미확정 사유 |
| applicability_evidence_ids | 범위/예외를 확인한 증거 ID 배열 |
| verdict | 통과/수정 필요/미확인/해당 없음 |
| extent | full/partial/none. 해당 항목의 실제 확인 범위 |
| evidence_ids | 판정 근거인 증거 ID 배열 |
| finding | 확인 사실과 해석의 범위, 미확인 사유 |
| impact | blocker/major/minor/none/unknown |
| recommendation | 수정 또는 다음 확인 방법 |
| exception | 사용한 예외와 대조 위치. 없으면 빈 문자열 |
| source_ids | 카탈로그와 같은 문헌 ID 배열 |

## 판정 규칙

- 통과: 적용 조건과 통과 조건을 해당 범위에서 확인하고, 전체 항목 확인 extent=full, 실제 증거가 있다. 최소 증거 층위를 충족해도 관찰 범위/목표/예외를 검증하지 않았다면 통과하지 않는다.
- 수정 필요: 직접 확인한 불일치와 영향, 실제 증거 및 조치를 적는다. 일부 경로의 결함도 기록할 수 있고 나머지 미확인 범위는 limitations에 적는다. 선언뿐이면 실제 결함으로 단정하지 않고 설계상 수정 제안과 미확인으로 반환한다.
- 미확인: 입력·검사·관찰·전문 판단이 부족함. 다음에 확인할 행동과 담당을 적는다. 해당 없음과 다르다.
- 해당 없음: 범위상 기능/조건이 부재하거나 적용되지 않는 사유가 있다. 초기 후보와 다른 비적용/예외는 실제 증거를 연결한다. 입력상 absent에 따른 비적용은 그 입력 범위에만 한정한다.
- applicability=unknown이면 verdict=미확인, not_applicable이면 해당 없음이다.

최소 증거 층위(pass_evidence_groups)는 v1 프로젝트 제안이다. 바깥 배열은 모두 필요하고 각 안쪽 배열은 대안 중 하나면 된다. 예: [[browser],[listening]]은 브라우저 동작과 실제 청취가 모두 필요하다. G09/C05/P03/P05/P08의 학생 이해·선호는 learner 증거 없이 통과할 수 없다. A05/P02/R06의 해당 기기 동작은 device 증거가 필요하다. S04는 실제 측정, R04는 실제 파일 열기, R10은 자산별 권리 대조가 필요하다. 이름·역할을 트리에서 확인한 A07 통과를 실기기나 화면 읽기 프로그램의 전체 사용성 검증으로 표현하지 않는다.

같은 레이어 내에서도 source 코드 검토는 실제 브라우저 실행을 대신하지 않는다. 설계안만 있는 design_only 프로필에는 실행·기기·학생 증거를 추가하지 않는다. 이후 실제 증거가 확보되면 profile과 scope를 갱신한다.

## 영향과 종합 결과

영향 등급은 학생 수준이나 법적 위반 등급이 아닌 수정 순서의 프로젝트 제안이다.

- blocker: 검수 범위의 핵심 활동을 완료할 수 없거나 필요한 의사소통이 차단되거나 실제 불필요한 민감/식별 정보 노출 등 즉시 해결할 결함. 확인된 영향과 대체 경로의 유무를 적는다.
- major: 완료는 가능하나 반복적인 오류·정보 누락·확인된 목표 해석의 왜곡 등 큰 제약.
- minor: 위 두 수준에 해당하지 않는 확인된 개선 사항.
- none: 통과/해당 없음. unknown: 미확인.

결함의 근거가 권장사항인지 표준 요구인지 표시한다. 불일치의 실제 영향이 없는 단순 선호를 blocker로 만들지 않는다. 총점이나 통과율로 핵심 결함을 상쇄하지 않는다.

종합은 수정 필요 → 미확인 → 검사 범위 내 통과 순으로 집계한다. 검사 범위 내 통과에도 전체 WCAG/KWCAG 적합성·모든 학생 사용 가능성·학습 효과의 보증은 포함되지 않는다. 실제 기기/학생 미검증 상태를 별도 명시한다.

## 사용자에게 보이는 보고서

결론과 검수 범위/버전을 먼저 제시하고, 영향 큰 수정 사항 → 항목별 결과·증거·근거 지위·예외 → 확인 필요 항목·다음 검사 순으로 쓴다. 전체 56개 기록은 JSON 또는 표로 제공할 수 있다. 근거 파일의 개인정보를 그대로 복사하지 않는다. 변경 후 검수는 실제로 바뀐 활동과 연관 경로를 다시 실행하고 새 버전·환경·증거로 결과를 갱신한다.

## 설계 전용 검토의 범위 표시

profile.target.artifact_kind=design_only에서 기능 present는 설계에 명시된 예정 기능이며 구현 확인이 아니다. basis에 문서 위치와 '계획'을 적고 scope_notes에도 설계 범위를 명시한다. 명시된 설계 부재는 absent, 아직 결정하지 않은 기능은 unknown이다. 예를 들어 예정된 TTS는 {state: present, basis: '설계안 활동 A: 낭독 계획'}, 저장 방식 미결정은 {state: unknown, basis: '설계안: 저장 미결정'}으로 기록한다. 구현 자료가 생기면 새로운 범위의 프로필을 작성하고 현재 상태를 다시 확인한다.

검토 작업의 완료와 제품 판정을 구분한다. 제공된 설계의 전체 항목 검토를 마쳤다면 보고서에 '설계 검토 완료, 제품 판정은 미확인'으로 표시하고 주요 설계 수정 제안을 먼저 제시한다. 이는 통과/수정 필요 등 제품 판정이나 R11/R12의 증거 조건을 변경하지 않는다. 선언뿐인 항목은 미확인과 다음 검사를 유지한다.
