import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
export const catalog = JSON.parse(fs.readFileSync(path.join(directory,'../references/catalog.json'),'utf8'));
const ids = new Map(catalog.criteria.map(c=>[c.criterion_id,c]));
const featureStates = new Set(['present','absent','unknown']);
const evidenceLayers = new Set(['declared','source','browser','device','learner','teacher','measurement','listening','export','rights']);
const actualLayers = new Set([...evidenceLayers].filter(x=>x!=='declared'));
const verdicts = new Set(['통과','수정 필요','미확인','해당 없음']);
const isObject = value => value !== null && typeof value==='object' && !Array.isArray(value);
const nonempty = value => typeof value==='string' && value.trim().length>0;
const strings = value => Array.isArray(value) && value.every(x=>typeof x==='string');
export function normalizeProfile(profile) {
  if (!isObject(profile) || !isObject(profile.target) || !nonempty(profile.target.name)) throw new Error('target.name이 필요합니다.');
  if (!['design_only','source_only','browser_only','mixed'].includes(profile.target.artifact_kind)) throw new Error('target.artifact_kind 값이 유효하지 않습니다.');
  if (!isObject(profile.features)) throw new Error('features 객체가 필요합니다.');
  const extras = Object.keys(profile.features).filter(x=>!catalog.features.includes(x));
  if (extras.length) throw new Error(`알 수 없는 기능: ${extras.join(', ')}`);
  const features = {};
  for (const key of catalog.features) {
    const item = profile.features[key] ?? {state:'unknown',basis:''};
    if (!isObject(item) || !featureStates.has(item.state) || typeof item.basis!=='string') throw new Error(`기능 ${key}: state/basis가 유효하지 않습니다.`);
    if (item.state!=='unknown' && !nonempty(item.basis)) throw new Error(`기능 ${key}: 존재/부재 근거가 필요합니다.`);
    features[key] = {...item};
  }
  if (!Array.isArray(profile.learning_goals) || profile.learning_goals.some(g=>!isObject(g)||!nonempty(g.id)||!nonempty(g.text)||!['confirmed','teacher_proposal','needs_confirmation'].includes(g.status))) throw new Error('learning_goals 형식이 유효하지 않습니다.');
  if (!isObject(profile.learner_context) || !strings(profile.learner_context.confirmed_access_needs) || !strings(profile.learner_context.unknowns) || !strings(profile.scope_notes)) throw new Error('learner_context/scope_notes는 문자열 배열을 사용합니다.');
  return {...structuredClone(profile),features};
}
export function routing(criterion,profile) {
  if (criterion.activation.always_screen) return {state:'applicable',reason:'공통 기준: 적용 조건·예외를 확인해야 함'};
  const keys = criterion.activation.any_features;
  const values = keys.map(k=>profile.features[k].state);
  const reason = keys.map(k=>`${k}=${profile.features[k].state}${profile.features[k].basis ? ` (${profile.features[k].basis})` : ''}`).join('; ');
  return {state:values.includes('present')?'applicable':values.every(v=>v==='absent')?'not_applicable':'unknown',reason};
}
export function makeDraft(input) {
  const profile = normalizeProfile(input);
  return {schema_version:'1.0',catalog_version:catalog.version,profile,reviewed_environment:[],evidence:[],results:catalog.criteria.map(c=>{
    const route = routing(c,profile);
    return {criterion_id:c.criterion_id,applicability:route.state,applicability_reason:route.reason,applicability_evidence_ids:[],verdict:route.state==='not_applicable'?'해당 없음':'미확인',extent:'none',evidence_ids:[],finding:route.state==='not_applicable'?'제공된 기능 범위에 따른 비적용 후보. 실제 범위·예외와 대조 필요.':'검사 증거를 아직 수집하지 않음',impact:route.state==='not_applicable'?'none':'unknown',recommendation:route.state==='not_applicable'?'기능 범위가 달라지면 재검수':c['검사방법'],exception:'',source_ids:c.source_ids.split(';')};
  }),limitations:['입력으로 만든 미확인 초안이며 실제 실행 결과가 아님','전체 WCAG/KWCAG 적합성·모든 학생 사용 가능성·학습 효과를 확정하지 않음']};
}
export function validateReview(review,baseDirectory=process.cwd()) {
  if (!isObject(review)) return ['검수 결과 객체가 필요함'];
  const errors = [];
  let profile;
  try { profile=normalizeProfile(review.profile); } catch(error) { errors.push(error.message); }
  if (review.schema_version!=='1.0' || review.catalog_version!==catalog.version) errors.push('스키마/카탈로그 버전 불일치');
  if (!strings(review.reviewed_environment) || !strings(review.limitations)) errors.push('환경/한계는 문자열 배열이어야 함');
  if (!Array.isArray(review.evidence) || !Array.isArray(review.results)) return [...errors,'evidence/results 배열이 필요함'];
  const evidence = new Map();
  for (const e of review.evidence) {
    if (!isObject(e) || !nonempty(e.id)) {errors.push('증거 ID 필요');continue;}
    if (evidence.has(e.id)) errors.push(`중복 증거 ID ${e.id}`);
    evidence.set(e.id,e);
    if (!evidenceLayers.has(e.layer) || ['artifact','location','environment','observation'].some(k=>!nonempty(e[k])) || !nonempty(e.observed_at) || !Number.isFinite(Date.parse(e.observed_at))) errors.push(`${e.id}: 증거 위치·환경·시점·관찰 필드 필요`);
    if (nonempty(e.artifact) && !/^https?:\/\//i.test(e.artifact) && !fs.existsSync(path.resolve(baseDirectory,e.artifact))) errors.push(`${e.id}: 로컬 증거 파일이 없음`);
    if (profile?.target.artifact_kind==='design_only' && ['browser','device','learner','measurement','listening','export'].includes(e.layer)) errors.push(`${e.id}: 설계 자료만 있는 범위에 실행 증거를 기록할 수 없음`);
  }
  const seen = new Set();
  for (const r of review.results) {
    if (!isObject(r) || !ids.has(r.criterion_id)) {errors.push('알 수 없는 기준 ID');continue;}
    const id = r.criterion_id, c=ids.get(id);
    if (seen.has(id)) errors.push(`${id}: 중복 기준`);
    seen.add(id);
    if (!['applicable','not_applicable','unknown'].includes(r.applicability) || !verdicts.has(r.verdict) || !['full','partial','none'].includes(r.extent) || !['blocker','major','minor','none','unknown'].includes(r.impact)) errors.push(`${id}: 상태 값이 유효하지 않음`);
    if (['applicability_reason','finding','recommendation'].some(k=>!nonempty(r[k])) || typeof r.exception!=='string') errors.push(`${id}: 판정 사유·결과·조치·예외 필드 필요`);
    if (!strings(r.evidence_ids) || !strings(r.applicability_evidence_ids) || !strings(r.source_ids)) {errors.push(`${id}: 증거/문헌 ID 배열 필요`);continue;}
    if (JSON.stringify(r.source_ids)!==JSON.stringify(c.source_ids.split(';'))) errors.push(`${id}: 문헌 근거가 카탈로그와 다름`);
    for (const ref of [...r.evidence_ids,...r.applicability_evidence_ids]) if (!evidence.has(ref)) errors.push(`${id}: 없는 증거 참조 ${ref}`);
    const layers = new Set(r.evidence_ids.map(ref=>evidence.get(ref)?.layer));
    const actual = [...layers].some(layer=>actualLayers.has(layer));
    if (r.applicability==='unknown' && r.verdict!=='미확인') errors.push(`${id}: 적용 미확정이면 미확인`);
    if ((r.applicability==='not_applicable')!==(r.verdict==='해당 없음')) errors.push(`${id}: 비적용/해당 없음 조합 불일치`);
    if (['통과','수정 필요'].includes(r.verdict) && (r.applicability!=='applicable' || !actual || r.extent==='none')) errors.push(`${id}: 실제 적용·관찰 증거·확인 범위 필요`);
    if (r.verdict==='통과' && (r.extent!=='full' || r.impact!=='none')) errors.push(`${id}: 통과는 항목 전체 확인과 영향 none 필요`);
    if (r.verdict==='통과') for (const group of c.pass_evidence_groups) if (!group.some(layer=>layers.has(layer))) errors.push(`${id}: 통과 최소 증거 필요 (${group.join(' 또는 ')})`);
    if (r.verdict==='수정 필요' && !['blocker','major','minor'].includes(r.impact)) errors.push(`${id}: 결함 영향 필요`);
    if (r.verdict==='미확인' && r.impact!=='unknown') errors.push(`${id}: 미확인 영향은 unknown`);
    if (r.verdict==='해당 없음' && r.impact!=='none') errors.push(`${id}: 해당 없음 영향은 none`);
    if (profile && r.verdict==='해당 없음' && routing(c,profile).state!=='not_applicable' && !r.applicability_evidence_ids.some(ref=>actualLayers.has(evidence.get(ref)?.layer))) errors.push(`${id}: 초기 적용 후보를 제외하려면 실제 범위/예외 증거 필요`);
  }
  if (seen.size!==ids.size || review.results.length!==ids.size) errors.push('56개 기준을 중복/누락 없이 기록해야 함');
  return [...new Set(errors)];
}
export function summarize(review) {
  const counts=Object.fromEntries([...verdicts].map(v=>[v,0]));
  for(const r of review.results) counts[r.verdict]++;
  return {conclusion:counts['수정 필요']?'수정 필요':counts['미확인']?'미확인':counts['통과']?'검사 범위 내 통과':'평가 항목 없음',counts,blockers:review.results.filter(r=>r.verdict==='수정 필요'&&r.impact==='blocker').map(r=>r.criterion_id),unconfirmed:review.results.filter(r=>r.verdict==='미확인').map(r=>r.criterion_id),limits:review.limitations};
}
function readJSON(filename) {return JSON.parse(fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''));}
function save(filename,value) {fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function main(argv) {
  const [command,...args]=argv;
  const flags={};
  for(let i=0;i<args.length;i+=2) {if(!['--input','--output'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--') || flags[args[i]]) throw new Error('인수는 --input/--output과 파일명으로 지정합니다.');flags[args[i]]=args[i+1];}
  if(command==='init') {
    if(!flags['--output']) throw new Error('--output이 필요합니다.');
    save(flags['--output'],{schema_version:'1.0',target:{name:'검수 대상',artifact_kind:'mixed',entry:null,version:'unknown'},learning_goals:[],learner_context:{confirmed_access_needs:[],unknowns:[]},features:Object.fromEntries(catalog.features.map(k=>[k,{state:'unknown',basis:''}])),scope_notes:['목표와 실제 제공 자료를 확인하여 작성']});
    console.log('입력 틀 생성. 기능 정보와 범위를 작성한 뒤 draft를 실행하세요.');return;
  }
  if(!flags['--input']) throw new Error('--input이 필요합니다.');
  const filename=path.resolve(flags['--input']),data=readJSON(filename);
  if(command==='draft') {if(!flags['--output']) throw new Error('--output이 필요합니다.');save(flags['--output'],makeDraft(data));console.log('56개 기준의 미확인 초안 생성. 실제 검수를 수행해 증거와 판정을 채우세요.');return;}
  if(!['validate','summary'].includes(command)) throw new Error('명령: init / draft / validate / summary');
  const errors=validateReview(data,path.dirname(filename));
  if(errors.length) {console.error(JSON.stringify({valid:false,errors},null,2));process.exitCode=1;return;}
  console.log(JSON.stringify(command==='summary'?summarize(data):{valid:true,criteria:56,note:'기록 구조와 최소 층위 검사만 통과. 관찰의 정확성·적합성·교육 효과는 별도 검토.'},null,2));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {main(process.argv.slice(2));} catch(error) {console.error(error.message);process.exitCode=1;}
}
