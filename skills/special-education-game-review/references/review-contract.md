# 입력·증거·판정 계약 v1.1

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

- schema_version: 1.1
- catalog_version: 1.1.0
- profile: 위 입력
- reviewed_environment: 실제로 검사한 환경 문자열 배열. 선언한 목표 기기와 구분한다.
- evidence: 관찰 기록 배열
- checks: 실행/계획한 검사 시나리오 배열. 실제 검사와 미실시 검사를 구분
- results: 56개 기준의 개별 결과. 해당 없음/미확인도 생략하지 않는다.
- limitations: 확인하지 못한 제품·학생·환경·표준 범위

증거 필드:

| 필드 | 의미 |
|---|---|
| id | 중복 없는 E01 등 ID |
| subject | product/review_process. 실제 제품 또는 검수 기록 대상 |
| layer | declared/source/document/review_record/browser/device/learner/teacher/measurement/listening/export/rights |
| artifact | URL 또는 로컬 파일 경로. 로컬 상대경로는 결과 JSON 위치 기준 |
| location | 줄·절·선택자·실행 단계·파일/오디오 위치 |
| environment | 실제 환경과 도구. 해당 없는 문서 검토는 문서 검토라고 명시 |
| observed_at | 실제 확인 시점 ISO8601 |
| observation | 직접 확인한 사실. 해석과 후속 계획을 섞지 않는다 |

문헌 source_ids와 위 evidence는 다르다. sources.json을 링크하는 것만으로 제품 증거를 만들지 않는다. declared는 사용자 설명/주장에만 쓴다. 계획된 시험, 입력 기능 상태, 목표 기기 선언을 실제 실행 증거로 기록하지 않는다. teacher/learner는 실제로 제공받거나 수행된 관찰의 기록이며 모델이 관찰자를 대신 생성하지 않는다.

source는 제품 코드 검토, document는 제품 설계·운영 문서 대조, review_record는 검수 보고서·증거표 자체의 확인이다. source/document는 subject=product, review_record는 subject=review_process이다. 검수자가 쓴 보고서를 product source로 분류하지 않는다. source/document 증거가 실제 브라우저 실행이나 학생 관찰을 대신하지 않는다. document는 제품 사실의 문서 대조에 사용하되 계획·주장뿐인 내용은 declared로 구분한다.

검사 시나리오 필드:

| 필드 | 의미 |
|---|---|
| id | 중복 없는 T01 등 ID |
| activity/input/environment | 검사한 활동, 실제 입력 방식, 화면·기기·도구 조건 |
| state | normal/error/counterexample/recovery/cancel/resume/document/other |
| status | planned/observed/blocked/not_run |
| precondition/steps | 검사 시작 상태와 실제 또는 계획한 입력 순서 배열 |
| expected/actual | 기대 결과와 실제 관찰. observed에 actual과 실제 증거가 필요 |
| evidence_ids | 실제 관찰을 기록한 증거 ID 배열 |

planned/not_run에는 실제 결과와 증거를 채우지 않는다. blocked는 도구 등으로 검사가 막힌 기록이며 제품 성공/실패의 실행 증거가 아니다. 문서·코드·제공받은 학생 관찰도 해당 입력/환경을 명시해 observed로 기록할 수 있다. checks는 웹사이트를 자동 실행하는 명령이 아니다.

결과 필드:

| 필드 | 값/의미 |
|---|---|
| criterion_id | G01 등 카탈로그 ID |
| evaluation_target | product/review_process. R11/R12만 review_process, 나머지 54개는 product |
| applicability | applicable/not_applicable/unknown |
| applicability_reason | 적용·비적용·미확정 사유 |
| applicability_evidence_ids | 범위/예외를 확인한 증거 ID 배열 |
| verdict | 통과/수정 필요/미확인/해당 없음 |
| extent | full/partial/none. 해당 항목의 실제 확인 범위 |
| evidence_ids | 판정 근거인 증거 ID 배열 |
| check_ids | 연결한 검사 시나리오 ID 배열. 제품 통과/수정 필요에는 해당 실제 검사 필요 |
| scope | {checked: 문자열 배열, unchecked: 문자열 배열}. 확인한 경로/환경과 제외한 범위 |
| finding | 확인 사실과 해석의 범위, 미확인 사유 |
| impact | blocker/major/minor/none/unknown |
| recommendation | 수정 또는 다음 확인 방법 |
| exception | 사용한 예외와 대조 위치. 없으면 빈 문자열 |
| source_ids | 카탈로그와 같은 문헌 ID 배열 |
| unconfirmed | 미확인 사유 배열. {reason, detail, next_action, owner} |
| impact_context | blocker일 때 {activity, input, environment, alternative, reason}. 없거나 미검사인 대안도 그대로 명시 |
| equivalence | A02의 관찰 결과에 {operation, learning_action, basis}. 상태는 confirmed/different/unknown/not_applicable |
| challenge | G03의 관찰 결과에 {applicability, basis, check_ids}. 반례 적용 여부·사유·검사 연결 |

unconfirmed.reason은 missing_material/not_tested/tool_limit/learner_device_observation/specialist_judgment 중 하나이다. 미확인 항목에는 적어도 한 사유와 다음 행동·담당을 기록한다. 일부 결함을 확인한 항목에도 남은 미확인 사항을 기록할 수 있다. 이유가 복수이면 배열에 나눠 기록한다.

## 판정 규칙

- 통과: 적용 조건과 통과 조건을 해당 범위에서 확인하고, 전체 항목 확인 extent=full, 실제 증거가 있다. 최소 증거 층위를 충족해도 관찰 범위/목표/예외를 검증하지 않았다면 통과하지 않는다.
- 수정 필요: 직접 확인한 불일치와 영향, 실제 증거 및 조치를 적는다. 일부 경로의 결함도 기록할 수 있고 나머지 미확인 범위는 limitations에 적는다. 선언뿐이면 실제 결함으로 단정하지 않고 설계상 수정 제안과 미확인으로 반환한다.
- 미확인: 입력·검사·관찰·전문 판단이 부족함. 다음에 확인할 행동과 담당을 적는다. 해당 없음과 다르다.
- 해당 없음: 범위상 기능/조건이 부재하거나 적용되지 않는 사유가 있다. 초기 후보와 다른 비적용/예외는 실제 증거를 연결한다. 입력상 absent에 따른 비적용은 그 입력 범위에만 한정한다.
- applicability=unknown이면 verdict=미확인, not_applicable이면 해당 없음이다.

제품 통과/수정 필요의 실제 근거는 subject=product이며 declared/review_record만으로 이를 판정할 수 없다. 연결한 observed 검사와 항목의 증거가 일치해야 한다. full은 scope.checked의 명시된 범위 전체를 확인했다는 뜻이며 제품 전체나 미검사 범위의 통과가 아니다. partial은 scope.unchecked에도 남은 범위를 적는다. 통과/수정 필요는 scope.checked가 비어 있을 수 없다.

A02 통과에는 실제 비드래그 포인터 기능 비교와 equivalence.operation=confirmed가 필요하다. learning_action이 unknown/different여도 기능 비교를 무조건 실패시키지 않고 G01/G02로 별도 검토한다. 목표 기술을 자동 대행한 수행을 학생 성취로 보고하지 않는다. 구체적인 비교와 반례 선택은 [활동 검사 절차](activity-checks.md)를 따른다.

G03의 challenge.applicability는 applicable/not_applicable/unknown이다. 반례가 적용되는 과제는 실제 error/counterexample 검사와 증거가 있어야 통과할 수 있다. 적용 여부가 unknown이면 통과하지 않는다. 창작 산물의 선호나 유일 정답이 없는 관계 확인 등 비적용에는 실제 검사 범위와 basis를 적는다. 해당 항목 자체를 생략하거나 창작 결과를 틀렸다고 판정하는 뜻이 아니다.

최소 증거 층위(pass_evidence_groups)는 프로젝트 제안이다. 바깥 배열은 모두 필요하고 각 안쪽 배열은 대안 중 하나면 된다. 예: [[browser],[listening]]은 브라우저 동작과 실제 청취가 모두 필요하다. G09/C05/P03/P05/P08의 학생 이해·선호는 learner 증거 없이 통과할 수 없다. A05/P02/R06의 해당 기기 동작은 device 증거가 필요하다. S04는 실제 측정, R04는 실제 파일 열기, R10은 자산별 권리 대조가 필요하다. R11/R12는 review_record 증거로 검수 기록을 평가한다. 이름·역할을 트리에서 확인한 A07 통과를 실기기나 화면 읽기 프로그램의 전체 사용성 검증으로 표현하지 않는다.

같은 레이어 내에서도 source 코드 검토는 실제 브라우저 실행을 대신하지 않는다. 설계안만 있는 design_only 프로필에는 실행·기기·학생 증거를 추가하지 않는다. 이후 실제 증거가 확보되면 profile과 scope를 갱신한다.

design_only의 제품 항목은 미확인 또는 근거 있는 해당 없음으로 반환하며 설계 수정 제안은 finding/recommendation에 적는다. 검수 기록 R11/R12의 확인과 제품 사용 판정을 혼합하지 않는다.

## 영향과 종합 결과

영향 등급은 학생 수준이나 법적 위반 등급이 아닌 수정 순서의 프로젝트 제안이다.

- blocker: 검수 범위의 핵심 활동을 완료할 수 없거나 필요한 의사소통이 차단되거나 실제 불필요한 민감/식별 정보 노출 등 즉시 해결할 결함. 확인된 영향과 대체 경로의 유무를 적는다.
- major: 완료는 가능하나 반복적인 오류·정보 누락·확인된 목표 해석의 왜곡 등 큰 제약.
- minor: 위 두 수준에 해당하지 않는 확인된 개선 사항.
- none: 통과/해당 없음. unknown: 미확인.

결함의 근거가 권장사항인지 표준 요구인지 표시한다. 불일치의 실제 영향이 없는 단순 선호를 blocker로 만들지 않는다. 총점이나 통과율로 핵심 결함을 상쇄하지 않는다.

제품 54개만으로 종합을 수정 필요 → 미확인 → 검사 범위 내 통과 순으로 집계한다. R11/R12는 review_process로 별도 집계하며 제품 통과 수에 넣지 않는다. 검수 기록에 결함이 있으면 기록 보완 필요를 별도로 제시하고 제품 결함으로 변환하지 않는다. 검사 범위 내 통과에도 전체 WCAG/KWCAG 적합성·모든 학생 사용 가능성·학습 효과의 보증은 포함되지 않는다. 실제 기기/학생 미검증 상태를 별도 명시한다.

## 사용자에게 보이는 보고서

결론과 검수 범위/버전을 먼저 제시하고, 영향 큰 수정 사항 → 항목별 결과·증거·근거 지위·예외 → 확인 필요 항목·다음 검사 순으로 쓴다. 전체 56개 기록은 JSON 또는 표로 제공할 수 있다. 근거 파일의 개인정보를 그대로 복사하지 않는다. 변경 후 검수는 실제로 바뀐 활동과 연관 경로를 다시 실행하고 새 버전·환경·증거로 결과를 갱신한다.

## 설계 전용 검토의 범위 표시

profile.target.artifact_kind=design_only에서 기능 present는 설계에 명시된 예정 기능이며 구현 확인이 아니다. basis에 문서 위치와 '계획'을 적고 scope_notes에도 설계 범위를 명시한다. 명시된 설계 부재는 absent, 아직 결정하지 않은 기능은 unknown이다. 예를 들어 예정된 TTS는 {state: present, basis: '설계안 활동 A: 낭독 계획'}, 저장 방식 미결정은 {state: unknown, basis: '설계안: 저장 미결정'}으로 기록한다. 구현 자료가 생기면 새로운 범위의 프로필을 작성하고 현재 상태를 다시 확인한다.

검토 작업의 완료와 제품 판정을 구분한다. 제공된 설계의 전체 항목 검토를 마쳤다면 보고서에 '설계 검토 완료, 제품 판정은 미확인'으로 표시하고 주요 설계 수정 제안을 먼저 제시한다. 이는 통과/수정 필요 등 제품 판정이나 R11/R12의 증거 조건을 변경하지 않는다. 선언뿐인 항목은 미확인과 다음 검사를 유지한다.

## 이전 기록과 재검수

v1 JSON은 원본을 보존한다. 새 사본에서 증거 대상/층, 검사 시나리오, 범위, 미확인 사유, 차단 조건을 확인한 뒤 1.1로 기록한다. 버전 문자열만 변경해서는 새 검사 요건을 충족하지 않는다. 새로 실행하지 않은 경우 '기존 관찰의 기록 재분류'와 원 관찰 날짜·환경을 표시하고 관찰 시점을 현재 시점으로 덮어쓰지 않는다. 이번에 검사하지 않은 수정 배포본에는 과거 결함 판정을 적용하지 않는다.

validate는 기록 구조·참조·최소 조건 검사이며 내용 오류 탐지기나 제품 합격 인증이 아니다. report/csv도 기록된 판정을 출력할 뿐 판정을 생성하지 않는다. 기존 출력 파일을 덮어쓰지 않는 도구 규칙을 유지한다.
