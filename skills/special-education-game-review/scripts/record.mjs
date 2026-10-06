const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(nonempty);
const reasons = new Set(['missing_material', 'not_tested', 'tool_limit', 'learner_device_observation', 'specialist_judgment']);
const states = new Set(['normal', 'error', 'counterexample', 'recovery', 'cancel', 'resume', 'document', 'other']);
const statuses = new Set(['planned', 'observed', 'blocked', 'not_run']);
const equivalenceStates = new Set(['confirmed', 'different', 'unknown', 'not_applicable']);

export function validateChecks(items, evidence, errors) {
  const checks = new Map();
  if (!Array.isArray(items)) {
    errors.push('checks 배열이 필요함');
    return checks;
  }
  for (const item of items) {
    if (!object(item) || !nonempty(item.id)) {
      errors.push('검사 시나리오 ID 필요');
      continue;
    }
    if (checks.has(item.id)) errors.push(`중복 검사 ID ${item.id}`);
    checks.set(item.id, item);
    if (!states.has(item.state) || !statuses.has(item.status) ||
        ['activity', 'input', 'environment', 'precondition', 'expected'].some(key => !nonempty(item[key])) ||
        !strings(item.steps) || item.steps.length === 0 || typeof item.actual !== 'string' ||
        !strings(item.evidence_ids)) {
      errors.push(`${item.id}: 검사 상태·활동·입력·환경·사전 상태·순서·기대/실제 결과 필요`);
      continue;
    }
    for (const id of item.evidence_ids) if (!evidence.has(id)) errors.push(`${item.id}: 없는 증거 참조 ${id}`);
    if (item.status === 'observed' && (!nonempty(item.actual) ||
        !item.evidence_ids.some(id => evidence.has(id) && evidence.get(id).layer !== 'declared'))) {
      errors.push(`${item.id}: 실제 검사에는 실제 결과와 관찰 증거 필요`);
    }
    if (['planned', 'not_run'].includes(item.status) && (nonempty(item.actual) || item.evidence_ids.length)) {
      errors.push(`${item.id}: 미실시 검사를 실제 결과·증거로 기록할 수 없음`);
    }
  }
  return checks;
}

export function validateResultRecord(result, criterion, evidence, checks, errors) {
  const id = result.criterion_id;
  if (result.evaluation_target !== criterion.evaluation_target) errors.push(`${id}: 제품/검수 기록 평가 대상 불일치`);
  if (!object(result.scope) || !strings(result.scope.checked) || !strings(result.scope.unchecked)) {
    errors.push(`${id}: scope.checked/unchecked 배열 필요`);
  } else {
    if (['통과', '수정 필요'].includes(result.verdict) && result.scope.checked.length === 0) errors.push(`${id}: 실제 확인한 범위 필요`);
    if (result.extent === 'partial' && result.scope.unchecked.length === 0) errors.push(`${id}: 부분 확인의 미검사 범위 필요`);
  }
  if (!strings(result.check_ids)) {
    errors.push(`${id}: check_ids 배열 필요`);
  } else {
    for (const ref of result.check_ids) if (!checks.has(ref)) errors.push(`${id}: 없는 검사 참조 ${ref}`);
    if (criterion.evaluation_target === 'product' && ['통과', '수정 필요'].includes(result.verdict)) {
      const observed = result.check_ids.map(ref => checks.get(ref)).filter(check => check?.status === 'observed');
      if (!observed.some(check => check.evidence_ids?.some(ref => result.evidence_ids?.includes(ref) && evidence.get(ref)?.subject === 'product' && evidence.get(ref)?.layer !== 'declared'))) {
        errors.push(`${id}: 판정 증거와 연결된 실제 제품 검사 필요`);
      }
      if (result.verdict === '통과' && result.check_ids.some(ref => checks.get(ref)?.status !== 'observed')) errors.push(`${id}: 미실시 검사를 포함한 전체 통과 불가`);
    }
  }
  if (!Array.isArray(result.unconfirmed)) {
    errors.push(`${id}: unconfirmed 배열 필요`);
  } else {
    if (result.verdict === '미확인' && result.unconfirmed.length === 0) errors.push(`${id}: 미확인 사유·다음 행동·담당 필요`);
    for (const item of result.unconfirmed) {
      if (!object(item) || !reasons.has(item.reason) || ['detail', 'next_action', 'owner'].some(key => !nonempty(item[key]))) errors.push(`${id}: 미확인 사유 분류·설명·다음 행동·담당 필요`);
    }
  }
  if (result.impact === 'blocker' && (!object(result.impact_context) ||
      ['activity', 'input', 'environment', 'alternative', 'reason'].some(key => !nonempty(result.impact_context[key])))) {
    errors.push(`${id}: 차단 활동·입력·환경·대안·영향 사유 필요`);
  }
  if (id === 'G03' && result.extent !== 'none' && result.verdict !== '해당 없음') {
    const challenge = result.challenge;
    if (!object(challenge) || !['applicable', 'not_applicable', 'unknown'].includes(challenge.applicability) ||
        !nonempty(challenge.basis) || !strings(challenge.check_ids)) {
      errors.push(`${id}: 반례 적용 여부·사유·검사 연결 필요`);
    } else {
      for (const ref of challenge.check_ids) if (!checks.has(ref) || !result.check_ids?.includes(ref)) errors.push(`${id}: 반례 검사를 항목의 검사와 연결해야 함`);
      if (result.verdict === '통과' && (challenge.applicability === 'unknown' ||
          (challenge.applicability === 'applicable' && !challenge.check_ids.some(ref => {
            const check = checks.get(ref);
            return check?.status === 'observed' && ['error', 'counterexample'].includes(check.state) &&
              check.evidence_ids?.some(evidenceId => result.evidence_ids?.includes(evidenceId));
          })))) errors.push(`${id}: 적용되는 오답·반례 확인 없이 정상 완료만으로 통과할 수 없음`);
    }
  }
  if (id === 'A02' && result.extent !== 'none' && result.verdict !== '해당 없음') {
    const comparison = result.equivalence;
    if (!object(comparison) || !equivalenceStates.has(comparison.operation) || !equivalenceStates.has(comparison.learning_action) || !nonempty(comparison.basis)) {
      errors.push(`${id}: 기능 동등성과 학습 행동 보존을 구분한 비교 필요`);
    } else if (result.verdict === '통과' && comparison.operation !== 'confirmed') {
      errors.push(`${id}: 같은 기능의 비드래그 포인터 대안을 확인해야 통과`);
    }
  }
}
