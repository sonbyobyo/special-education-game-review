import path from 'node:path';

const cell = value => String(value ?? '').replace(/[\\`*_\[\]<>|]/g, character => '\\' + character).replace(/[\r\n]+/g, ' / ');
const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const reasons = items => items.map(item => `${item.reason}: ${item.detail} → ${item.next_action} (${item.owner})`).join('; ');

export function renderCSV(review, catalog) {
  const criteria = new Map(catalog.criteria.map(item => [item.criterion_id, item]));
  const rows = [['평가 대상', 'ID', '영역', '기준', '판정', '적용', '검사범위', '확인한 경로·환경', '미검사 범위', '영향', '차단 조건·대안', '기능 동등성', '학습 행동 보존', '비교 근거', '확인 사실·미확인 사유', '수정·다음 확인', '미확인 분류·담당', '증거', '검사', '근거 지위', '문헌ID', '예외', '반례 적용·검사']];
  for (const result of review.results) {
    const criterion = criteria.get(result.criterion_id);
    rows.push([result.evaluation_target, result.criterion_id, criterion['영역'], criterion['기준'], result.verdict,
      result.applicability, result.extent, result.scope.checked.join('; '), result.scope.unchecked.join('; '), result.impact,
      result.impact_context ? JSON.stringify(result.impact_context) : '', result.equivalence?.operation ?? '',
      result.equivalence?.learning_action ?? '', result.equivalence?.basis ?? '', result.finding, result.recommendation,
      reasons(result.unconfirmed), result.evidence_ids.join('; '), result.check_ids.join('; '), criterion['근거지위'], result.source_ids.join('; '), result.exception, result.challenge ? JSON.stringify(result.challenge) : '']);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function renderReport(review, catalog, summary, baseDirectory = process.cwd()) {
  const criteria = new Map(catalog.criteria.map(item => [item.criterion_id, item]));
  const lines = [
    '# ' + cell(review.profile.target.name) + ' 검수', '',
    '**제품 결과: ' + cell(summary.product.conclusion) + '.** 검수 기록 결과: ' + cell(summary.review_process.conclusion) + '.', '',
    '대상: ' + cell(review.profile.target.entry ?? '제공된 자료') + ' / 버전: ' + cell(review.profile.target.version) + '.',
    '기록 형식 ' + review.schema_version + ' / 카탈로그 ' + review.catalog_version + '. 제품과 검수 기록의 결과를 분리한다.', '',
    '## 범위와 한계', '',
    ...review.profile.scope_notes.map(item => '- ' + cell(item)), '',
    '관찰 환경: ' + review.reviewed_environment.map(cell).join('; '), '',
    ...review.limitations.map(item => '- ' + cell(item)), '',
    '목표 확인 상태:', '',
    ...review.profile.learning_goals.map(item => '- ' + cell(item.id + ' / ' + item.status + ': ' + item.text)), '',
    '## 집계', '', '| 평가 대상 | 항목 | 통과 | 수정 필요 | 미확인 | 해당 없음 |', '|---|---:|---:|---:|---:|---:|'
  ];
  for (const [name, group] of [['제품', summary.product], ['검수 기록 R11/R12', summary.review_process]]) {
    lines.push('| ' + [name, group.criteria, ...['통과', '수정 필요', '미확인', '해당 없음'].map(key => group.counts[key])].join(' | ') + ' |');
  }
  lines.push('', cell(summary.note), '', '## 확인한 제품 결함', '');
  const rank = { blocker: 0, major: 1, minor: 2 };
  const defects = review.results.filter(item => item.evaluation_target === 'product' && item.verdict === '수정 필요').sort((left, right) => rank[left.impact] - rank[right.impact]);
  if (!defects.length) lines.push('기록된 제품 결함 없음. 미확인 항목과 미검사 범위의 통과를 뜻하지 않는다.', '');
  for (const item of defects) {
    lines.push('### ' + item.criterion_id + ' ' + cell(criteria.get(item.criterion_id)['기준']) + ' (' + item.impact + ')', '',
      cell(item.finding), '', '확인 범위: ' + item.scope.checked.map(cell).join('; '),
      '미검사: ' + item.scope.unchecked.map(cell).join('; '));
    if (item.impact_context) lines.push('차단 조건·대안: ' + cell(Object.entries(item.impact_context).map(([key, value]) => key + '=' + value).join('; ')));
    lines.push('조치: ' + cell(item.recommendation), '증거: ' + item.evidence_ids.join(', ') + ' / 검사: ' + item.check_ids.join(', '), '');
  }
  lines.push('## 검사 시나리오', '', 'observed는 기록된 실제 관찰이다. planned/blocked/not_run은 제품 통과 증거가 아니다.', '');
  for (const item of review.checks) {
    lines.push('### ' + cell(item.id + ' ' + item.activity + ' / ' + item.state + ' / ' + item.status), '',
      '입력·환경: ' + cell(item.input + ' / ' + item.environment), '사전 상태: ' + cell(item.precondition),
      ...item.steps.map((step, index) => String(index + 1) + '. ' + cell(step)),
      '기대: ' + cell(item.expected), '실제: ' + cell(item.actual || '미실시'),
      '증거: ' + item.evidence_ids.join(', '), '');
  }
  for (const target of ['product', 'review_process']) {
    lines.push('## ' + (target === 'product' ? '제품 54개' : '검수 기록 2개') + ' 항목', '',
      '| ID | 기준 | 판정·범위 | 관찰·조치 | 미확인 사유·다음 행동·담당 | 증거·검사·문헌 |', '|---|---|---|---|---|---|');
    for (const item of review.results.filter(result => result.evaluation_target === target)) {
      const criterion = criteria.get(item.criterion_id);
      const details = [item.finding, '조치: ' + item.recommendation, '확인: ' + item.scope.checked.join('; '), '미검사: ' + item.scope.unchecked.join('; '), '근거 지위: ' + criterion['근거지위']];
      if (item.equivalence) details.push('대안 비교: ' + JSON.stringify(item.equivalence));
      if (item.challenge) details.push('반례 적용·검사: ' + JSON.stringify(item.challenge));
      if (item.exception) details.push('예외: ' + item.exception);
      lines.push('| ' + [item.criterion_id, criterion['기준'], item.verdict + ' / ' + item.extent, details.join(' / '), reasons(item.unconfirmed), item.evidence_ids.join(', ') + ' / ' + item.check_ids.join(', ') + ' / ' + item.source_ids.join(', ')].map(cell).join(' | ') + ' |');
    }
    lines.push('');
  }
  lines.push('## 증거 원장', '', '문헌 ID는 기준 근거이며 제품 통과 증거가 아니다. review\_record는 제품 코드 검토가 아니다.', '');
  for (const item of review.evidence) {
    const target = /^https?:\/\//i.test(item.artifact) ? item.artifact : path.resolve(baseDirectory, item.artifact).split(path.sep).join('/');
    const link = target.replaceAll('>', '%3E').replaceAll('<', '%3C').replace(/[\r\n]/g, '');
    lines.push('- [' + cell(item.id) + '](<' + link + '>) / ' + cell(item.subject + ' / ' + item.layer + ' / ' + item.observed_at),
      '  ' + cell(item.observation) + ' (' + cell(item.location + ' / ' + item.environment) + ')');
  }
  lines.push('', '기록 구조·참조의 검증은 내용 정확성, 전체 표준 준수, 학생 적합성 또는 학습 효과를 보증하지 않는다.', '');
  return lines.join('\n');
}
