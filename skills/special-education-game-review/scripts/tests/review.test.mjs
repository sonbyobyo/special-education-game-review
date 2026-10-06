import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { catalog, makeDraft, validateReview, summarize, renderReport, renderCSV } from '../review.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = fileURLToPath(import.meta.url);
const profile = { target: { name: '합성 기록 시험', artifact_kind: 'browser_only', entry: null, version: 'synthetic' }, features: {}, learning_goals: [], learner_context: { confirmed_access_needs: [], unknowns: [] }, scope_notes: ['형식·판정 경계 시험이며 실제 브라우저·학생 관찰이 아님'] };
const row = (review, id) => review.results.find(item => item.criterion_id === id);
const errors = review => validateReview(review);

function recorded(id, verdict = '통과', { layer = 'browser', subject = 'product', state = 'normal' } = {}) {
  const review = makeDraft(profile);
  review.evidence.push({ id: 'E01', layer, subject, artifact: fixture, location: '합성 검사 입력', environment: '자동 형식 시험; 실제 브라우저/학생 관찰 아님', observed_at: '2026-10-06T01:00:00.000Z', observation: '유효성 검사 경계를 위한 합성 입력' });
  review.checks.push({ id: 'T01', activity: '합성 대표 활동', input: 'pointer', environment: '합성 시험 환경', state, status: 'observed', precondition: '시험 입력 생성', steps: ['대표 응답 입력'], expected: '판정 필드와 근거 연결', actual: '합성 결과 기록', evidence_ids: ['E01'] });
  Object.assign(row(review, id), { applicability: 'applicable', applicability_reason: '합성 시험 적용 조건', verdict, extent: 'full', evidence_ids: ['E01'], check_ids: ['T01'], scope: { checked: ['합성 대표 경로'], unchecked: [] }, finding: '합성 판정 기록', recommendation: '확인 범위만 유지', impact: verdict === '수정 필요' ? 'major' : 'none', unconfirmed: [] });
  if (id === 'A02') row(review, id).equivalence = { operation: 'confirmed', learning_action: 'unknown', basis: '기능 비교만 확인; 교사 목표 미제공' };
  if (id === 'G03') row(review, id).challenge = { applicability: 'applicable', basis: '구성 상태와 설명의 불일치 가능성을 검사', check_ids: ['T01'] };
  return review;
}

test('56개 고유 ID, 제품 54개와 기록 2개, 48개 기능 유지', () => {
  assert.equal(catalog.criteria.length, 56);
  assert.equal(new Set(catalog.criteria.map(item => item.criterion_id)).size, 56);
  assert.equal(catalog.features.length, 48);
  assert.deepEqual(catalog.criteria.filter(item => item.evaluation_target === 'review_process').map(item => item.criterion_id), ['R11', 'R12']);
});
test('초안은 입력을 변경하지 않고 미확인으로 유지', () => {
  const input = structuredClone(profile), draft = makeDraft(input);
  draft.profile.learner_context.unknowns.push('추가 확인');
  assert.deepEqual(input, profile);
  assert.deepEqual(errors(draft), []);
  assert.equal(summarize(draft).product.counts['미확인'], 54);
});
test('기능 존재/부재는 확인 근거가 필요하고 미제공은 unknown', () => {
  const input = structuredClone(profile);
  assert.equal(row(makeDraft(input), 'A02').applicability, 'unknown');
  input.features.dragging = { state: 'absent', basis: '' };
  assert.throws(() => makeDraft(input));
  input.features.dragging.basis = '지정한 시험 범위에 드래그 없음';
  assert.equal(row(makeDraft(input), 'A02').verdict, '해당 없음');
});
test('누락·중복 기준, 없는 증거와 검사 참조 거부', () => {
  const review = recorded('A01');
  review.results.pop();
  review.results[1] = structuredClone(review.results[0]);
  row(review, 'A01').evidence_ids.push('missing');
  row(review, 'A01').check_ids.push('missing');
  assert(errors(review).some(item => item.includes('56개')));
  assert(errors(review).some(item => item.includes('중복 기준')));
  assert(errors(review).some(item => item.includes('없는 증거')));
  assert(errors(review).some(item => item.includes('없는 검사')));
});
test('기존 v1 기록의 버전만 자동 수용하지 않음', () => {
  const review = makeDraft(profile);
  review.schema_version = '1.0'; review.catalog_version = '1.0.0';
  assert(errors(review).some(item => item.includes('이전 기록')));
});
test('선언 증거만으로 제품 통과 불가', () => assert(errors(recorded('A01', '통과', { layer: 'declared' })).some(item => item.startsWith('A01'))));
test('부분 범위를 전체 통과로 승격 불가', () => {
  const review = recorded('A01'); row(review, 'A01').extent = 'partial';
  row(review, 'A01').scope.unchecked = ['상위 단계'];
  assert(errors(review).some(item => item.includes('통과는 항목 전체')));
});
test('부분 확인에는 미검사 범위가 필요', () => {
  const review = recorded('G03', '수정 필요'); row(review, 'G03').extent = 'partial';
  assert(errors(review).some(item => item.includes('부분 확인의 미검사')));
});
test('실제 제품 검사가 없이 증거만 연결한 통과 거부', () => {
  const review = recorded('A01'); row(review, 'A01').check_ids = [];
  assert(errors(review).some(item => item.includes('실제 제품 검사')));
});
test('시나리오와 판정의 증거가 다르면 거부', () => {
  const review = recorded('A01');
  review.evidence.push({ ...review.evidence[0], id: 'E02' });
  review.checks[0].evidence_ids = ['E02'];
  assert(errors(review).some(item => item.includes('판정 증거와 연결')));
});
test('계획 시험에 실제 결과·증거를 붙이면 거부', () => {
  const review = recorded('A01'); review.checks[0].status = 'planned';
  assert(errors(review).some(item => item.includes('미실시 검사를 실제')));
});
test('blocked 시험은 제품 완료 증거가 아님', () => {
  const review = recorded('A01'); review.checks[0].status = 'blocked';
  assert(errors(review).some(item => item.includes('실제 제품 검사')));
});
test('관찰 시험에는 실제 결과와 관찰 증거가 필요', () => {
  const review = recorded('A01'); review.checks[0].actual = '';
  assert(errors(review).some(item => item.includes('실제 검사에는')));
});
test('차단 판정은 입력·환경·대체 경로를 기록해야 함', () => {
  const review = recorded('A01', '수정 필요'); row(review, 'A01').impact = 'blocker';
  assert(errors(review).some(item => item.includes('차단 활동')));
  row(review, 'A01').impact_context = { activity: '정답 제출', input: 'keyboard', environment: '시험 화면', alternative: '포인터 경로는 가능; 키보드 대안 아님', reason: '해당 입력으로 완료 불가' };
  assert.deepEqual(errors(review), []);
  assert.deepEqual(summarize(review).product.blockers, ['A01']);
});
test('미확인은 이유·후속 행동·담당을 필요로 함', () => {
  const review = makeDraft(profile); row(review, 'C05').unconfirmed = [];
  assert(errors(review).some(item => item.includes('미확인 사유')));
  row(review, 'C05').unconfirmed = [{ reason: 'learner_device_observation', detail: '실제 지시 이해 미관찰', next_action: '합의한 조건에서 학생 관찰', owner: '' }];
  assert(errors(review).some(item => item.includes('분류·설명')));
});
test('A02는 클릭 경로의 같은 기능 확인이 필요', () => {
  const review = recorded('A02'); row(review, 'A02').equivalence.operation = 'different';
  assert(errors(review).some(item => item.includes('같은 기능')));
});
test('A02 기능 확인과 교사 목표 미확인을 분리', () => {
  const review = recorded('A02');
  assert.deepEqual(errors(review), []);
  assert.equal(row(review, 'G02').verdict, '미확인');
  row(review, 'A02').equivalence.learning_action = 'different';
  assert.deepEqual(errors(review), []);
});
test('제품 코드만으로 A02 실제 포인터 경로 통과 불가', () => assert(errors(recorded('A02', '통과', { layer: 'source' })).some(item => item.includes('최소 증거'))));
test('브라우저만으로 학생 이해·실기기·실제 청취 통과 불가', () => {
  for (const id of ['G09', 'C05', 'A05', 'R06', 'S06']) assert(errors(recorded(id)).some(item => item.startsWith(id) && item.includes('최소 증거')), id);
});
test('설계안만 있는 범위의 제품 통과를 거부', () => {
  const review = recorded('G03', '통과', { layer: 'document', state: 'document' });
  review.profile.target.artifact_kind = 'design_only';
  assert(errors(review).some(item => item.includes('설계 자료만 있는 범위는 제품 판정')));
});
test('검수 문서를 제품 source 코드로 분류하면 거부', () => assert(errors(recorded('R11', '통과', { layer: 'source', subject: 'review_process' })).some(item => item.includes('검수 문서를 제품 코드'))));
test('검수 기록만으로 제품 판정 통과 불가', () => assert(errors(recorded('A01', '통과', { layer: 'review_record', subject: 'review_process' })).some(item => item.startsWith('A01'))));
test('R11/R12 통과가 제품 통과 개수에 더해지지 않음', () => {
  const review = recorded('R11', '통과', { layer: 'review_record', subject: 'review_process' });
  Object.assign(row(review, 'R12'), structuredClone(row(review, 'R11')), { criterion_id: 'R12', source_ids: catalog.criteria.find(item => item.criterion_id === 'R12').source_ids.split(';') });
  assert.deepEqual(errors(review), []);
  assert.equal(summarize(review).product.counts['통과'], 0);
  assert.equal(summarize(review).review_process.counts['통과'], 2);
});
test('검수 기록 결함을 제품 결함으로 변환하지 않음', () => {
  const review = recorded('R11', '수정 필요', { layer: 'review_record', subject: 'review_process' });
  assert.deepEqual(errors(review), []);
  assert.equal(summarize(review).conclusion, '미확인');
  assert.equal(summarize(review).review_process.conclusion, '수정 필요');
});
test('불균등 성공 반례의 결함 기록은 수정 필요로 집계', () => {
  const review = recorded('G03', '수정 필요', { state: 'counterexample' });
  review.checks[0].precondition = '합성 사례: 간식 10개, 대상 2명';
  review.checks[0].steps = ['9/1로 배치', '계산 답 5 선택'];
  review.checks[0].expected = '불균등 안내'; review.checks[0].actual = '고루 분배 성공 안내';
  row(review, 'G03').finding = '계산 정답과 9/1 구성 설명이 불일치';
  assert.deepEqual(errors(review), []);
  assert.equal(summarize(review).conclusion, '수정 필요');
});
test('수정된 합성 사례의 새 기록에 이전 결함을 남기지 않음', () => {
  const review = recorded('G03', '통과', { state: 'counterexample' });
  review.checks[0].expected = '9/1에 불균등 안내, 5/5에 성공 안내';
  review.checks[0].actual = '9/1 성공 차단 후 5/5 수정에 성공';
  row(review, 'G03').finding = '명시한 합성 정상/반례 범위의 설명과 구성 일치';
  assert.deepEqual(errors(review), []);
  assert.equal(summarize(review).product.counts['수정 필요'], 0);
  assert.equal(summarize(review).product.counts['통과'], 1);
});
test('G03 정상 완료만으로 적용되는 반례 검사 통과 불가', () => {
  const review = recorded('G03');
  assert(errors(review).some(item => item.includes('정상 완료만으로 통과')));
});
test('G03 반례 적용 미확정을 통과로 승격 불가', () => {
  const review = recorded('G03', '통과', { state: 'counterexample' });
  row(review, 'G03').challenge.applicability = 'unknown';
  assert(errors(review).some(item => item.includes('정상 완료만으로 통과')));
});
test('창작형의 명시한 비적용은 유일 정답을 강제하지 않음', () => {
  const review = recorded('G03', '통과', { state: 'other' });
  row(review, 'G03').challenge = { applicability: 'not_applicable', basis: '자유 창작 결과의 선호는 정오답 대상 아님. 제시한 재료 관계의 사실 정확성만 관찰', check_ids: [] };
  assert.deepEqual(errors(review), []);
});
test('창작 사례의 선호 차이를 단일 정답 결함으로 집계하지 않음', () => {
  const review = makeDraft(profile); row(review, 'G03').finding = '자유 창작 모양은 유일 정답 없음; 재료 관계 설명은 별도 검사 필요';
  assert.deepEqual(errors(review), []);
  assert.equal(summarize(review).product.counts['수정 필요'], 0);
});
test('CSV·보고서가 실제 기록의 구분과 특수 문자를 보존', () => {
  const review = recorded('G03', '수정 필요');
  row(review, 'G03').finding = '쉼표, "따옴표"와\n줄바꿈 | <태그>';
  const csv = renderCSV(review, catalog);
  assert(csv.startsWith('\uFEFF"평가 대상"'));
  assert(csv.includes('"쉼표, ""따옴표""와\n줄바꿈 | <태그>"'));
  const report = renderReport(review, catalog, summarize(review));
  assert(report.includes('| 제품 | 54 |'));
  assert(report.includes('| 검수 기록 R11/R12 | 2 |'));
  assert(report.includes('\\| \\<태그\\>'));
});
test('CLI init→draft→validate→summary→report/csv 실제 실행, 덮어쓰기 거부', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'special-education-review-test-'));
  const cli = path.resolve(here, '../review.mjs');
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: directory });
  assert.equal(run(['init', '--output', 'intake.json']).status, 0);
  assert.equal(run(['draft', '--input', 'intake.json', '--output', 'review.json']).status, 0);
  assert.equal(run(['validate', '--input', 'review.json']).status, 0);
  const summary = run(['summary', '--input', 'review.json']);
  assert.equal(summary.status, 0);
  assert.equal(JSON.parse(summary.stdout).product.criteria, 54);
  for (const [command, output] of [['report', 'report.md'], ['csv', 'criteria.csv']]) {
    assert.equal(run([command, '--input', 'review.json', '--output', output]).status, 0);
    const before = fs.readFileSync(path.join(directory, output));
    assert.notEqual(run([command, '--input', 'review.json', '--output', output]).status, 0);
    assert.deepEqual(fs.readFileSync(path.join(directory, output)), before);
  }
});
