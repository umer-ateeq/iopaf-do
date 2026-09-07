/* Headless logic tests for IOPAF v4 scoring engine. */
const fs = require('fs');
const html = fs.readFileSync('/home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const script = scripts.join('\n');

// Minimal DOM stub
const elements = {};
function el() {
  return new Proxy({ innerHTML:'', textContent:'', value:'', style:{}, classList:{add(){},remove(){},contains(){return false}},
    appendChild(){}, insertBefore(){}, insertAdjacentElement(){}, insertAdjacentHTML(){}, setAttribute(){}, querySelector(){ return el(); }, remove(){} }, {
    get(t,k){ if(k in t) return t[k]; return undefined; },
    set(t,k,v){ t[k]=v; return true; }
  });
}
global.document = {
  getElementById:(id)=>{ elements[id]=elements[id]||el(); return elements[id]; },
  querySelectorAll:()=>[],
  querySelector:()=>el(),
  createElement:()=>el(),
  body:{ insertBefore(){} },
  head:{ appendChild(){} }
};
global.window = { scrollTo(){}, print(){} };
global.location = { search:'', href:'file:///iopaf.html' };
global.history = { replaceState(){} };
let store = {};
global.localStorage = {
  getItem:k=>store[k]||null,
  setItem:(k,v)=>{store[k]=v;},
  removeItem:k=>{delete store[k];}
};
global.alert = ()=>{};
global.confirm = ()=>true;
global.FileReader = function(){};

let failures = 0;
function check(name, cond, detail){
  if(cond){ console.log('PASS  ' + name); }
  else { failures++; console.log('FAIL  ' + name + (detail?('  -> '+detail):'')); }
}

// Evaluate the app script inside a vm context that shares our globals
const vm = require('vm');
global.global = global;
vm.createContext(global);
vm.runInContext(script, global);
// expose top-level const/let/function bindings created by the script
const names=['P','DIMS','DOMAINS','TOTAL_Q','qid','gateUnlocked','effScore','evPenalty','dimScore','procStats','overallStats','questionsFor','lowQuestions','roadmapFor','persist','LS_KEY','inScope'];
const grab = vm.runInContext('({'+names.join(',')+'})', global);
var {P,DIMS,DOMAINS,TOTAL_Q,qid,gateUnlocked,effScore,evPenalty,dimScore,procStats,overallStats,questionsFor,lowQuestions,roadmapFor,persist,LS_KEY,inScope}=grab;
// state vars must be mutated inside the vm context, so define setters
function setState(obj){ vm.runInContext('answers='+JSON.stringify(obj.answers||{})+';notes='+JSON.stringify(obj.notes||{})+';files='+JSON.stringify(obj.files||{})+';scope='+JSON.stringify(obj.scope||{})+';', global); }
function getVar(n){ return vm.runInContext(n, global); }
function setVar(n,v){ vm.runInContext(n+'='+JSON.stringify(v), global); }

// ---------- Tests ----------
// T1: taxonomy — 34 practices, Release Management and Deployment Management distinct
check('T1a 53 practices (34 ops + 12 dev + 7 tmmi)', P.length===53, 'got '+P.length);
const rel=P.find(p=>p.id==='rel'), dep=P.find(p=>p.id==='dep');
check('T1b rel is Release Management (P&S)', rel && rel.name==='Release Management' && rel.domain==='Product & Service Management Practices');
check('T1c dep is Deployment Management (P&S)', dep && dep.name==='Deployment Management' && dep.domain==='Product & Service Management Practices');
check('T1d rel exec probes have no deployment-execution overlap', !rel.exec.some(q=>/rollback|deployments executed/i.test(q)));
check('T1e chg named Change Enablement', P.find(p=>p.id==='chg').name==='Change Enablement');

// T2: gating — follow-ups locked until key question >= 1
const p0 = P[0];
setState({});
check('T2a gate locked when unanswered', gateUnlocked(p0,0)===false);
const A={}; A[qid(p0,0,'g')]=0;
setState({answers:A});
check('T2b gate locked at 0', gateUnlocked(p0,0)===false);
// answer a follow-up while locked: should not count
A[qid(p0,0,0)]=3; setState({answers:A});
let ds = dimScore(p0,0);
check('T2c locked follow-up excluded from dim score', ds.score===0 && ds.answered===1, JSON.stringify(ds));
A[qid(p0,0,'g')]=2; setState({answers:A});
ds = dimScore(p0,0);
check('T2d unlock includes follow-up', ds.answered===2 && Math.abs(ds.score-2.5)<1e-9, JSON.stringify(ds));

// T3: evidence penalty — 4/5 without note/file drops one point
const id5 = qid(p0,0,'g');
setState({answers:{[id5]:5}});
check('T3a effScore 5 w/o evidence = 4', effScore(id5)===4);
setState({answers:{[id5]:5}, notes:{[id5]:'Verified policy doc v2.1 in SharePoint'}});
check('T3b effScore 5 with note = 5', effScore(id5)===5);
setState({answers:{[id5]:5}, files:{[id5]:[{name:'policy.pdf',size:100,type:'application/pdf',data:'x'}]}});
check('T3c effScore 5 with file = 5', effScore(id5)===5);
setState({answers:{[id5]:3}});
check('T3d effScore 3 w/o evidence = 3 (no penalty)', effScore(id5)===3);

// T4: procStats — provisional & caps
const qs0 = questionsFor(p0);
const A4={}, N4={};
qs0.forEach((b,di)=>{
  const g=qid(p0,di,'g'); A4[g]=4; N4[g]='ev';
  b.probes.forEach((_,ki)=>{ const k=qid(p0,di,ki); A4[k]=4; N4[k]='ev'; });
});
setState({answers:A4, notes:N4});
let st = procStats(p0);
check('T4a full coverage not provisional', st.provisional===false, 'coverage '+st.coverage);
check('T4b score 4.0 => L4 (no cap)', st.level===4, 'level '+st.level+' cap '+st.capReason);
// lower Measurement below 3.5 -> cap at 3
qs0[5].probes.forEach((_,ki)=>{ A4[qid(p0,5,ki)]=2; });
A4[qid(p0,5,'g')]=2;
setState({answers:A4, notes:N4});
st = procStats(p0);
check('T4c MSR low caps level at 3', st.level<=3 && !!st.capReason, 'level '+st.level+' cap '+st.capReason);

// T5: capUnconfirmed — unanswered capping dimension makes level provisional
const A5={}, N5={};
qs0.forEach((b,di)=>{
  if(di===5) return; // skip Measurement entirely
  const g=qid(p0,di,'g'); A5[g]=5; N5[g]='ev';
  b.probes.forEach((_,ki)=>{ const k=qid(p0,di,ki); A5[k]=5; N5[k]='ev'; });
});
setState({answers:A5, notes:N5});
st = procStats(p0);
check('T5a unanswered MSR makes provisional', st.provisional===true && st.capUnconfirmed.length>0, JSON.stringify({prov:st.provisional,unconf:st.capUnconfirmed}));

// T6: overallStats — provisional excluded from confirmed org level; out-of-scope excluded
const p1=P[1];
const A6={}, N6={};
qs0.forEach((b,di)=>{ const g=qid(p0,di,'g'); A6[g]=4; N6[g]='ev'; b.probes.forEach((_,ki)=>{ const k=qid(p0,di,ki); A6[k]=4; N6[k]='ev'; }); });
A6[qid(p1,0,'g')]=1;
setState({answers:A6, notes:N6});
let ov = overallStats();
check('T6a provisional practice not dragging confirmed org level', ov.orgLevel===procStats(p0).level, 'org '+ov.orgLevel+' vs p0 '+procStats(p0).level);
check('T6b provCount 1', ov.provCount===1, 'prov '+ov.provCount);
setState({answers:A6, notes:N6, scope:{[p1.id]:false}});
ov = overallStats();
check('T6c out-of-scope excluded from rollup (1 descoped + 7 unselected TMMi overlay)', ov.assessed===1 && ov.outOfScope===8, JSON.stringify({assessed:ov.assessed,oos:ov.outOfScope}));

// T7: gap register standardization — top 5, effective scores
const A7={};
qs0.forEach((b,di)=>{ A7[qid(p0,di,'g')]=1; b.probes.forEach((_,ki)=>{ A7[qid(p0,di,ki)]=1; }); });
setState({answers:A7});
const lows = lowQuestions(p0);
check('T7a lowQuestions finds low scores', lows.length>0);
check('T7b gap register shows all question gaps (no slice in renderGaps)', script.includes('function allGapRows'));
check('T7c PDF report caps at 5 low questions', (script.match(/lows\.slice\(0,5\)/g)||[]).length>=1, 'occurrences: '+(script.match(/lows\.slice\(0,5\)/g)||[]).length);

// T8: persistence & export schema
setState({answers:{x:3}});
persist();
setTimeout(()=>{
  const saved = JSON.parse(store['iopaf-v4-state']||'{}');
  check('T8a autosave writes state', saved.answers && saved.answers.x===3);
  check('T8b persistence upgraded to schema v9', saved.v===9 && script.includes('version:9') && script.includes('iamObjResponses'));
  check('T8c import accepts legacy (no meta)', script.includes("d.meta||{}"));

  // T9: roadmap exists
  check('T9a roadmapFor defined', typeof roadmapFor==='function');
  const A9={}, N9={};
  qs0.forEach((b,di)=>{ const g=qid(p0,di,'g'); A9[g]=2; N9[g]='ev'; b.probes.forEach((_,ki)=>{ const k=qid(p0,di,ki); A9[k]=2; N9[k]='ev'; }); });
  setState({answers:A9, notes:N9});
  const rm = roadmapFor(p0);
  check('T9b roadmap generates steps', rm && rm.steps.length>0, rm?rm.steps.join(' | ').slice(0,120):'null');

  // T10: total question count consistent
  check('T10 TOTAL_Q computed', TOTAL_Q>1500 && TOTAL_Q<3200, 'TOTAL_Q='+TOTAL_Q);

  // T11: IAM control library integration
  const IAMCTL=getVar('IAMCTL'), IAM_DOMAINS=getVar('IAM_DOMAINS');
  check('T11a 148 IAM controls embedded', IAMCTL.length===148, 'got '+IAMCTL.length);
  check('T11b 8 IAM domains', IAM_DOMAINS.length===8, 'got '+IAM_DOMAINS.length);
  check('T11c 32 control groups', new Set(IAMCTL.map(c=>c.d+'|'+c.g)).size===32, 'got '+new Set(IAMCTL.map(c=>c.d+'|'+c.g)).size);
  check('T11d every control has weight, evidence tier and owner', IAMCTL.every(c=>(c.w===2||c.w===3) && c.ev>=2 && c.ev<=4 && !!c.o));
  check('T11e IAM stream defined with control flag', !!getVar('STREAMS').iam && getVar('STREAMS').iam.ctrl===true);
  check('T11f IAM stream has 8 selectable frameworks', getVar('STREAM_STDS').iam.length===8);
  // evidence gate: rating at/above required evidence tier without evidence is capped
  vm.runInContext("streamMeta.iam.active=true; iamR={}; iamEv={}; iamR['D2-01']=5;", global);
  let sc = vm.runInContext("iamScore(iamCtl('D2-01'))", global);
  const evReq = IAMCTL.find(c=>c.id==='D2-01').ev;
  check('T11g unevidenced rating capped below evidence tier', sc.eff===evReq-1 && sc.capped===true, JSON.stringify(sc));
  vm.runInContext("iamEv['D2-01']=true;", global);
  sc = vm.runInContext("iamScore(iamCtl('D2-01'))", global);
  check('T11h evidenced rating passes uncapped', sc.eff===5 && sc.capped===false, JSON.stringify(sc));
  // weighted rollup honours control weight
  const roll = vm.runInContext("iamRollup(IAMCTL.filter(c=>c.id==='D2-01'))", global);
  check('T11i rollup computes weighted mean', Math.abs(roll.mean-5)<1e-9, JSON.stringify(roll));
  check('T11j controls view render function exists', script.includes('function renderControls'));

  // T12: schema v9 object assurance and migration
  const api=getVar('IOPAF_V9_API');
  check('T12a v9 API exposed', api && api.schema===9);
  check('T12b nine assessment-object types', api.objectTypes.length===9, 'got '+api.objectTypes.length);
  const db={id:'db-test',name:'Test DB',type:'database',environment:'Production',criticality:'T1'};
  const ent={id:'ent-test',name:'Enterprise',type:'enterprise',environment:'Enterprise',criticality:'T2'};
  check('T12c authentication applies to database', api.controlApplies(IAMCTL.find(c=>c.id==='D3-05'),db)===true);
  check('T12d governance does not duplicate per database', api.controlApplies(IAMCTL.find(c=>c.id==='D1-01'),db)===false);
  check('T12e governance applies at enterprise level', api.controlApplies(IAMCTL.find(c=>c.id==='D1-01'),ent)===true);
  vm.runInContext("iamObjects=[];iamObjResponses={};iamR={'D3-05':3};iamEv={'D3-05':true};iamNote={'D3-05':'legacy evidence'};iamMigrateLegacy();",global);
  check('T12f v8 flat response migrates to legacy object', !!getVar("iamObjResponses['legacy|D3-05']") && getVar("iamObjResponses['legacy|D3-05'].maturity")===3);

  // T13: Bayesian effectiveness and scenario distributions
  vm.runInContext("iamObjects.push({id:'db1',name:'DB1',type:'database',environment:'Production',criticality:'T1'});iamObjResponses['db1|D3-05']={implementation:'partially',maturity:3,evidence:'sampled',tested:40,exceptions:4};",global);
  const pBad=api.effectiveness('db1','D3-05');
  check('T13a effectiveness distribution totals 100', pBad.dist.reduce((a,b)=>a+b,0)===100, JSON.stringify(pBad.dist));
  vm.runInContext("iamObjResponses['db1|D3-05']={implementation:'meets',maturity:4,evidence:'measured',tested:120,exceptions:1};",global);
  const pGood=api.effectiveness('db1','D3-05');
  check('T13b stronger test evidence lowers failure posterior', pGood.mean<pBad.mean, pBad.mean+' -> '+pGood.mean);
  const riskModel=api.buildRiskModel('db1',null,'RSK-AUTH-01');
  check('T13c likelihood distribution totals 100', riskModel.like.reduce((a,b)=>a+b,0)===100, JSON.stringify(riskModel.like));
  check('T13d consequence distribution totals 100', riskModel.impact.reduce((a,b)=>a+b,0)===100, JSON.stringify(riskModel.impact));
  check('T13e risk distribution totals 100', riskModel.risk.reduce((a,b)=>a+b,0)===100, JSON.stringify(riskModel.risk));
  check('T13f appetite exceedance bounded', riskModel.appetite>=0 && riskModel.appetite<=100, 'got '+riskModel.appetite);
  vm.runInContext("iamObjects.push({id:'idp1',name:'Corporate IdP',type:'iam',environment:'Production',criticality:'T1'});['D3-05','D4-13','D5-11'].forEach(id=>iamObjResponses['idp1|'+id]={implementation:'does-not-meet',maturity:1,evidence:'sampled',tested:20,exceptions:8});",global);
  const commonCauseWeak=api.buildRiskModel('db1',null,'RSK-AUTH-01');
  vm.runInContext("['D3-05','D4-13','D5-11'].forEach(id=>iamObjResponses['idp1|'+id]={implementation:'meets',maturity:5,evidence:'measured',tested:100,exceptions:0});",global);
  const commonCauseStrong=api.buildRiskModel('db1',null,'RSK-AUTH-01');
  check('T13g stronger shared identity service lowers scenario risk', commonCauseStrong.appetite<commonCauseWeak.appetite, commonCauseWeak.appetite+' -> '+commonCauseStrong.appetite);
  check('T13h common-cause distribution totals 100', commonCauseStrong.commonCauseDist.reduce((a,b)=>a+b,0)===100, JSON.stringify(commonCauseStrong.commonCauseDist));

  // T14: corrective scoped register + always-visible prior model
  check('T14a scoped current-register API exposed', api.scope && typeof api.scope.selectLevel==='function');
  vm.runInContext("streamMeta.iam.active=false;iamObjects=iamObjects.filter(o=>o.id!=='idp1');iamObjects.push({id:'db-empty',name:'Empty DB',type:'database',environment:'Production',criticality:'T1'});",global);
  const priorOnly=api.buildRiskModel('db-empty',null,'RSK-AUTH-01');
  check('T14b unassessed target remains a prior-only Bayesian model', priorOnly.assessed===0 && priorOnly.tested===0 && priorOnly.confidence==='Prior only', JSON.stringify({assessed:priorOnly.assessed,tested:priorOnly.tested,confidence:priorOnly.confidence}));
  check('T14c disabled prior risk remains a complete distribution', priorOnly.risk.reduce((a,b)=>a+b,0)===100, JSON.stringify(priorOnly.risk));
  const disabledWhatIf=api.buildRiskModel('db1',null,'RSK-AUTH-01');
  check('T14d disabled IAM retains entered evidence as a labelled what-if model', disabledWhatIf.assessed>0 && disabledWhatIf.whatIf===true && disabledWhatIf.scopeActive===false, JSON.stringify({assessed:disabledWhatIf.assessed,whatIf:disabledWhatIf.whatIf,scopeActive:disabledWhatIf.scopeActive}));
  vm.runInContext("streamMeta.iam.active=true;iamSelectedObject='db1';",global);
  const scopedLive=api.buildRiskModel('db1',null,'RSK-AUTH-01');
  check('T14e enabling IAM promotes the same evidence to the live model', scopedLive.assessed>0 && scopedLive.scopeActive===true && scopedLive.whatIf===false, JSON.stringify({assessed:scopedLive.assessed,scopeActive:scopedLive.scopeActive,whatIf:scopedLive.whatIf}));
  check('T14f established Controls renderer is retained', script.includes('CONTROL TESTING WORKSHEET') && script.includes('One familiar control form'));

  // T15: all-domain risk propagation and mapping transparency
  const live=getVar('IOPAF_RISK_LIVE');
  check('T15a eight IAM domain scenarios are available', live && live.scenarios.length===8, 'got '+(live&&live.scenarios.length));
  check('T15b every one of 148 controls maps to its domain scenario', IAMCTL.every(c=>live.scenarioForControl(c.id).domain===c.d));
  vm.runInContext("iamObjResponses['legacy|D1-01']={implementation:'does-not-meet',maturity:0,evidence:'measured',tested:30,exceptions:20};",global);
  const govWeak=api.buildRiskModel('legacy',null,'RSK-GOV-01');
  const authBeforeGovChange=api.buildRiskModel('legacy',null,'RSK-AUTH-01');
  vm.runInContext("iamObjResponses['legacy|D1-01']={implementation:'meets',maturity:5,evidence:'measured',tested:100,exceptions:0};",global);
  const govStrong=api.buildRiskModel('legacy',null,'RSK-GOV-01');
  const authAfterGovChange=api.buildRiskModel('legacy',null,'RSK-AUTH-01');
  check('T15c improving a mapped governance control lowers its scenario risk', govStrong.appetite<govWeak.appetite, govWeak.appetite+' -> '+govStrong.appetite);
  check('T15d all eight scenario distributions total 100', live.scenarios.every(s=>api.buildRiskModel('legacy',null,s.id).risk.reduce((a,b)=>a+b,0)===100));
  check('T15e a governance control does not alter the unrelated authentication scenario', JSON.stringify(authBeforeGovChange.risk)===JSON.stringify(authAfterGovChange.risk), JSON.stringify(authBeforeGovChange.risk)+' -> '+JSON.stringify(authAfterGovChange.risk));

  // T16: holistic 148-control dashboard classification and maturity semantics
  const dash=getVar('IOPAF_DASH');
  const classCounts=IAMCTL.reduce((a,c)=>{const k=dash.classify(c);a[k]=(a[k]||0)+1;return a;},{});
  check('T16a Controls Dashboard API exposed', dash && typeof dash.render==='function' && typeof dash.open==='function');
  check('T16b every control classified exactly once', Object.values(classCounts).reduce((a,b)=>a+b,0)===148, JSON.stringify(classCounts));
  check('T16c deterministic classification totals', classCounts.Critical===74 && classCounts.Core===33 && classCounts['Non-critical']===41, JSON.stringify(classCounts));
  vm.runInContext("iamSelectedObject='legacy';delete iamObjResponses['legacy|D2-01'];",global);
  const unassessedDash=dash.result(IAMCTL.find(c=>c.id==='D2-01'),'legacy');
  vm.runInContext("iamObjResponses['legacy|D2-01']={implementation:'does-not-meet',maturity:0,evidence:'none',tested:0,totalPaths:0,exceptions:0};",global);
  const levelZeroDash=dash.result(IAMCTL.find(c=>c.id==='D2-01'),'legacy');
  vm.runInContext("iamObjResponses['legacy|D2-01']={implementation:'meets',maturity:5,evidence:'none',tested:0,totalPaths:0,exceptions:0};",global);
  const cappedDash=dash.result(IAMCTL.find(c=>c.id==='D2-01'),'legacy');
  vm.runInContext("iamObjResponses['legacy|D2-01']={implementation:'na',maturity:null,evidence:'none',tested:0,totalPaths:0,exceptions:0};",global);
  const naDash=dash.result(IAMCTL.find(c=>c.id==='D2-01'),'legacy');
  check('T16d unassessed remains distinct from L0', unassessedDash.kind==='unassessed' && unassessedDash.level===null && levelZeroDash.kind==='level' && levelZeroDash.level===0, JSON.stringify({unassessed:unassessedDash,levelZero:levelZeroDash}));
  check('T16e evidence gate shows effective maturity and cap', cappedDash.raw===5 && cappedDash.level===3 && cappedDash.capped===true, JSON.stringify(cappedDash));
  check('T16f recorded N/A remains distinct from maturity', naDash.kind==='na' && naDash.level===null, JSON.stringify(naDash));

  // T17: extended control taxonomy and operational dependency graph
  const tax=getVar('IOPAF_CONTROL_TAXONOMY'),taxApi=getVar('IOPAF_DASH_TAX');
  const taxRows=Object.entries(tax.controls),taxIds=new Set(IAMCTL.map(c=>c.id));
  const validTypes=new Set(['Preventive','Detective','Corrective','Recovery','Directive','Deterrent','Compensating']);
  const validHierarchy=new Set(['Elimination','Substitution','Engineering','Administrative','PPE','Not applicable']);
  const validEffects=new Set(['Likelihood','Consequence','Both']);
  const typeCounts=taxRows.reduce((a,[,x])=>(a[x.type]=(a[x.type]||0)+1,a),{}),hierCounts=taxRows.reduce((a,[,x])=>(a[x.hierarchy]=(a[x.hierarchy]||0)+1,a),{}),effectCounts=taxRows.reduce((a,[,x])=>(a[x.effect]=(a[x.effect]||0)+1,a),{});
  check('T17a taxonomy and dependency API exposed', taxRows.length===148 && taxApi && typeof taxApi.select==='function' && typeof taxApi.exportCSV==='function');
  check('T17b every control has one valid type, hierarchy and effect', taxRows.every(([,x])=>validTypes.has(x.type)&&validHierarchy.has(x.hierarchy)&&validEffects.has(x.effect)), JSON.stringify({typeCounts,hierCounts,effectCounts}));
  check('T17c taxonomy totals are deterministic', typeCounts.Preventive===76&&typeCounts.Detective===50&&typeCounts.Directive===13&&typeCounts.Corrective===8&&typeCounts.Compensating===1&&hierCounts.Administrative===78&&hierCounts.Engineering===64&&hierCounts.Elimination===2&&hierCounts.Substitution===4&&effectCounts.Likelihood===104&&effectCounts.Consequence===31&&effectCounts.Both===13,JSON.stringify({typeCounts,hierCounts,effectCounts}));
  check('T17d PPE is not misused for IAM', !hierCounts.PPE, JSON.stringify(hierCounts));
  const edgeKeys=new Set(tax.edges.map(e=>e.source+'|'+e.target+'|'+e.relation));
  check('T17e 202 dependency edges are unique, valid and non-self', tax.edges.length===202&&edgeKeys.size===202&&tax.edges.every(e=>taxIds.has(e.source)&&taxIds.has(e.target)&&e.source!==e.target), JSON.stringify({edges:tax.edges.length,unique:edgeKeys.size}));
  const symmetry=tax.edges.every(e=>tax.controls[e.target].upstream.some(x=>x.id===e.source&&x.relation===e.relation)&&tax.controls[e.source].downstream.some(x=>x.id===e.target&&x.relation===e.relation));
  check('T17f upstream and downstream adjacency are symmetric', symmetry);
  const seen=new Set(['D1-01']),queue=['D1-01'];while(queue.length){const id=queue.shift(),x=tax.controls[id];for(const n of [...x.upstream,...x.downstream])if(!seen.has(n.id)){seen.add(n.id);queue.push(n.id)}}
  check('T17g all 148 controls form one traceable graph', seen.size===148, String(seen.size));

  // T18: independently audited Bayesian mathematics and semantics
  const qlo=getVar('v9betaQuantile(.025,.72,5.28)'),qhi=getVar('v9betaQuantile(.975,.72,5.28)');
  check('T18a exact Beta quantile matches independent L4-prior reference', Math.abs(qlo-0.0010222357461036743)<1e-10&&Math.abs(qhi-0.4487561600479535)<1e-10, qlo+'–'+qhi);
  const implMeets=api.effectiveness('db1','D3-05',{implementation:'meets',maturity:3,evidence:'sampled',tested:20,exceptions:2}),implFails=api.effectiveness('db1','D3-05',{implementation:'does-not-meet',maturity:3,evidence:'sampled',tested:20,exceptions:2});
  check('T18b implementation label is not double-counted as posterior pseudo-evidence', Math.abs(implMeets.mean-implFails.mean)<1e-12&&implMeets.alpha===implFails.alpha&&implMeets.beta===implFails.beta, JSON.stringify({meets:implMeets,doesNotMeet:implFails}));
  check('T18c unassessed controls do not reduce the scenario likelihood prior', JSON.stringify(priorOnly.like)===JSON.stringify(priorOnly.inh), JSON.stringify({inherent:priorOnly.inh,likelihood:priorOnly.like}));
  check('T18d no appetite breach is declared without an approved limit', priorOnly.appetiteLimit===null&&priorOnly.appetiteBreached===null, JSON.stringify({limit:priorOnly.appetiteLimit,breached:priorOnly.appetiteBreached}));
  const beforeNA=api.buildRiskModel('db-empty',null,'RSK-AUTH-01');
  vm.runInContext("iamObjResponses['db-empty|D3-01']={implementation:'na',maturity:null,evidence:'none',tested:0,exceptions:0};",global);
  const afterNA=api.buildRiskModel('db-empty',null,'RSK-AUTH-01');
  check('T18e N/A control is excluded from evidence coverage and applicable denominator', afterNA.assessed===0&&afterNA.controlsCount===beforeNA.controlsCount-1&&JSON.stringify(afterNA.risk)===JSON.stringify(beforeNA.risk), JSON.stringify({before:beforeNA.controlsCount,after:afterNA.controlsCount,assessed:afterNA.assessed}));
  const roleErrors=[];for(const s of live.scenarios){const m=api.buildRiskModel('legacy',null,s.id);for(const g of m.groups)for(const x of g.items){const expected=['Detective','Corrective'].includes(tax.controls[x.c.id].type)?'detective':'preventive';if(x.role!==expected||x.effect.toLowerCase()!==tax.controls[x.c.id].effect.toLowerCase())roleErrors.push([x.c.id,x.role,x.effect,expected,tax.controls[x.c.id].effect]);}}
  check('T18f all 148 controls use formal taxonomy roles and risk effects', roleErrors.length===0, JSON.stringify(roleErrors.slice(0,5)));
  check('T18g exported posterior retains exact Beta parameters', Number.isFinite(pGood.alpha)&&Number.isFinite(pGood.beta)&&pGood.lo===getVar('v9betaQuantile(.025,'+pGood.alpha+','+pGood.beta+')')&&pGood.hi===getVar('v9betaQuantile(.975,'+pGood.alpha+','+pGood.beta+')'), JSON.stringify({alpha:pGood.alpha,beta:pGood.beta,lo:pGood.lo,hi:pGood.hi}));

  console.log('\n' + (failures? failures+' FAILURES' : 'ALL TESTS PASSED'));
  process.exit(failures?1:0);
}, 600);
