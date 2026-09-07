import { chromium } from 'playwright';
import fs from 'fs';

const url='file:///home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html';
const out='/home/ubuntu/iopaf_v4/v9_browser_shots';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
page.on('dialog',d=>d.accept());

await page.goto(url,{waitUntil:'load'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'load'});

const base=await page.evaluate(()=>({schema:IOPAF_V9_API.schema,objects:iamObjects.length,controls:IAMCTL.length,domains:IAM_DOMAINS.length}));
if(base.schema!==9||base.objects!==1||base.controls!==148||base.domains!==8)throw new Error('Unexpected baseline '+JSON.stringify(base));

await page.evaluate(()=>go('setup'));
await page.fill('#v9-new-name','Oracle Finance Database — Production');
await page.selectOption('#v9-new-type','database');
await page.selectOption('#v9-new-env','Production');
await page.selectOption('#v9-new-tier','T1');
await page.click('#iam-object-register .btn-primary');
await page.waitForTimeout(100);

const dbId=await page.evaluate(()=>iamObjects.find(o=>o.type==='database'&&!o.legacy)?.id);
if(!dbId)throw new Error('Database object not created');
await page.evaluate((id)=>{
  iamSelectedObject=id;iamRiskState.objectId=id;iamSelectedControl='D3-05';
  const values={
    'D3-05':{implementation:'partially',maturity:3,evidence:'sampled',tested:40,totalPaths:4,exceptions:4,note:'MFA is enforced through CyberArk and the bastion. One password-only emergency path remains open.'},
    'D4-13':{implementation:'meets',maturity:4,evidence:'measured',tested:80,totalPaths:6,exceptions:2,note:'Approved roles are enforced; two direct legacy grants remain.'},
    'D5-11':{implementation:'partially',maturity:3,evidence:'sampled',tested:32,totalPaths:4,exceptions:3,note:'JIT is standard; one standing break-glass account remains.'},
    'D5-15':{implementation:'meets',maturity:4,evidence:'measured',tested:48,totalPaths:3,exceptions:1,note:'Privileged sessions are recorded and reviewed.'},
    'D8-05':{implementation:'meets',maturity:4,evidence:'measured',tested:60,totalPaths:5,exceptions:1,note:'SIEM correlation covers database and PAM events.'}
  };
  for(const [cid,v] of Object.entries(values))iamObjResponses[iamObjKey(id,cid)]=Object.assign(iamResponseTemplate(),v,{updated:new Date().toISOString()});
  persist();go('controls');renderControls();
},dbId);
await page.waitForTimeout(650);

await page.screenshot({path:out+'/01-controls-object-assurance.png',fullPage:true});
const controls=await page.evaluate(()=>({object:iamObject(iamSelectedObject).name,selected:iamSelectedControl,rows:document.querySelectorAll('.v9-compare tbody tr').length,dist:[...document.querySelectorAll('.v9-dlabels b')].map(x=>x.textContent)}));
if(controls.selected!=='D3-05'||controls.rows<2)throw new Error('Controls view not rendered '+JSON.stringify(controls));

await page.evaluate(()=>{go('results');iamEnsureRiskPanel();const b=document.querySelector('[data-panel="panel-risk"]');resTab(b);iamRiskState.view='summary';renderBayesianRisk();});
await page.waitForTimeout(100);
await page.screenshot({path:out+'/02-risk-summary.png',fullPage:true});
const summary=await page.evaluate(()=>{const m=iamBuildRiskModel(iamRiskState.objectId);return {like:m.like,impact:m.impact,risk:m.risk,appetite:m.appetite,assessed:m.assessed,tested:m.tested};});
for(const k of ['like','impact','risk'])if(summary[k].reduce((a,b)=>a+b,0)!==100)throw new Error(k+' does not total 100');

await page.evaluate(()=>{iamRiskState.view='network';renderBayesianRisk();});
await page.waitForTimeout(100);
await page.screenshot({path:out+'/03-bayesian-network.png',fullPage:true});
const network=await page.evaluate(()=>({nodes:document.querySelectorAll('.v9-bn:not(.layer)').length,links:document.querySelectorAll('.v9-bn-links path').length,labels:[...document.querySelectorAll('.v9-bn .h b')].map(x=>x.textContent)}));
if(network.nodes!==11||network.links<14)throw new Error('Network incomplete '+JSON.stringify(network));

await page.evaluate(()=>{iamRiskState.view='evidence';renderBayesianRisk();});
await page.screenshot({path:out+'/04-model-evidence.png',fullPage:true});
await page.waitForTimeout(650);
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('iopaf-v4-state')));
if(saved.v!==9||!saved.iamObjects||!saved.iamObjResponses)throw new Error('Schema v9 not persisted');

await browser.close();
const report={base,dbId,controls,summary,network,saved:{v:saved.v,objects:saved.iamObjects.length,responses:Object.keys(saved.iamObjResponses).length},errors};
fs.writeFileSync('/home/ubuntu/iopaf_v4/v9_browser_test_report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
