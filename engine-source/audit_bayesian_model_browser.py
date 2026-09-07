import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from scipy.stats import beta

PORTAL = "file:///home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html"
OUT = Path("/home/ubuntu/iopaf_v4/bayesian_model_browser_audit.json")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    page.goto(PORTAL, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")

    result = page.evaluate(
        """async () => {
        const api=IOPAF_RISK_LIVE, tax=IOPAF_CONTROL_TAXONOMY.controls;
        streamMeta.iam.active=true;
        const legacy=iamObject('legacy'); legacy.criticality='T2';
        const mk=(id,name,type,criticality)=>({id,name,type,environment:'Production',criticality,owner:'Audit',provider:'Internal',legacy:false});
        const dbA=mk('audit-db-a','Audit DB A','database','T2');
        const dbB=mk('audit-db-b','Audit DB B','database','T2');
        const t1=mk('audit-t1','Audit T1','database','T1');
        const t2=mk('audit-t2','Audit T2','database','T2');
        const t3=mk('audit-t3','Audit T3','database','T3');
        iamObjects=[legacy,dbA,dbB,t1,t2,t3]; iamObjResponses={};
        const sum=a=>a.reduce((x,y)=>x+y,0);
        const scenarios=api.scenarios.map(s=>{
          const m=api.build(dbA.id,null,s.id);
          return {id:s.id,domain:s.domain,controls:m.controlsCount,groups:m.groups.length,assessed:m.assessed,tested:m.tested,prevent:m.prevent,detect:m.detect,like:m.like,impact:m.impact,risk:m.risk,appetite:m.appetite,normalization:{inherent:sum(m.inh),like:sum(m.like),impact:sum(m.impact),risk:sum(m.risk),common:sum(m.commonCauseDist)}};
        });
        const mapping=IAMCTL.map(c=>({id:c.id,domain:c.d,scenario:api.scenarioForControl(c.id).id,expected:api.scenarios.find(s=>s.domain===c.d).id}));

        // Infer the model role assigned to every control from its containing group.
        const roleRows=[];
        api.scenarios.forEach(s=>{const m=api.build(dbA.id,null,s.id);m.groups.forEach(g=>g.items.forEach(x=>roleRows.push({id:x.c.id,domain:x.c.d,group:g.name,groupRole:g.role,modelRole:x.role,modelEffect:x.effect,taxonomyType:tax[x.c.id].type,taxonomyEffect:tax[x.c.id].effect})));});
        const expectedRole=t=>t==='Detective'||t==='Corrective'?'detective':'preventive';
        const roleMismatches=roleRows.filter(x=>x.modelRole!==expectedRole(x.taxonomyType));
        const mixedGroups=[];
        api.scenarios.forEach(s=>{const m=api.build(dbA.id,null,s.id);m.groups.forEach(g=>{const types=[...new Set(g.items.map(x=>tax[x.c.id].type))];const expected=[...new Set(g.items.map(x=>expectedRole(tax[x.c.id].type)))];if(expected.length>1)mixedGroups.push({scenario:s.id,group:g.name,modelRole:g.role,types,controls:g.items.map(x=>x.c.id)});});});

        // Exhaustive single-control sensitivity from the same prior state.
        const sensitivity=[];
        api.scenarios.forEach(s=>{
          const base=api.build(dbA.id,null,s.id);
          base.effects&&Object.keys(base.effects).forEach(id=>{
            const good={};good[id]={maturity:5,evidence:'measured',tested:40,exceptions:0,implementation:'meets'};
            const bad={};bad[id]={maturity:0,evidence:'none',tested:40,exceptions:40,implementation:'does-not-meet'};
            const moreEx={};moreEx[id]={maturity:3,evidence:'sampled',tested:40,exceptions:8,implementation:'partially'};
            const fewerEx={};fewerEx[id]={maturity:3,evidence:'sampled',tested:40,exceptions:2,implementation:'partially'};
            const mg=api.build(dbA.id,good,s.id),mb=api.build(dbA.id,bad,s.id),mx=api.build(dbA.id,moreEx,s.id),mf=api.build(dbA.id,fewerEx,s.id);
            sensitivity.push({scenario:s.id,id,baseAppetite:base.appetite,goodAppetite:mg.appetite,badAppetite:mb.appetite,fewerExceptionAppetite:mf.appetite,moreExceptionAppetite:mx.appetite,goodLike:mg.likeProb,badLike:mb.likeProb});
          });
        });

        // Target isolation.
        const beforeA=api.build(dbA.id,null,'RSK-AUTH-01'),beforeB=api.build(dbB.id,null,'RSK-AUTH-01');
        const authControls=IAMCTL.filter(c=>c.d==='D3'&&iamControlApplies(c,dbA));
        authControls.forEach(c=>iamObjResponses[iamObjKey(dbA.id,c.id)]={...iamResponseTemplate(),maturity:5,evidence:'measured',tested:40,exceptions:0,implementation:'meets'});
        const afterA=api.build(dbA.id,null,'RSK-AUTH-01'),afterB=api.build(dbB.id,null,'RSK-AUTH-01');

        // N/A behavior: one N/A control should not be treated as effective evidence or alter a domain aggregate.
        iamObjResponses={};
        const baseNA=api.build(dbA.id,null,'RSK-AUTH-01');
        const naId=baseNA.effects?Object.keys(baseNA.effects)[0]:authControls[0].id;
        iamObjResponses[iamObjKey(dbA.id,naId)]={...iamResponseTemplate(),implementation:'na',note:'Not applicable for this audit target.'};
        const afterNA=api.build(dbA.id,null,'RSK-AUTH-01');

        // Empty shared IAM object should not change a target's prior-only risk.
        iamObjResponses={};iamObjects=[legacy,dbA,dbB,t1,t2,t3];
        const noShared=api.build(dbA.id,null,'RSK-AUTH-01');
        const shared=mk('audit-shared','Audit Shared IAM','iam','T2');iamObjects.push(shared);
        const emptyShared=api.build(dbA.id,null,'RSK-AUTH-01');

        // Criticality ordering.
        const crit=['RSK-AUTH-01','RSK-PAM-01'].map(sid=>{
          const a=api.build(t1.id,null,sid),b=api.build(t2.id,null,sid),c=api.build(t3.id,null,sid);
          const expected=d=>d.reduce((z,v,i)=>z+v*i,0)/100;
          return {scenario:sid,T1:{impact:expected(a.impact),appetite:a.appetite},T2:{impact:expected(b.impact),appetite:b.appetite},T3:{impact:expected(c.impact),appetite:c.appetite}};
        });

        return {
          scenarios,mapping,
          mappingErrors:mapping.filter(x=>x.scenario!==x.expected),
          roleRows,roleMismatches,mixedGroups,sensitivity,
          monotonicity:{
            strongerIncreasesRisk:sensitivity.filter(x=>x.goodAppetite>x.baseAppetite||x.goodLike>x.badLike),
            weakerReducesRisk:sensitivity.filter(x=>x.badAppetite<x.baseAppetite||x.badLike<x.goodLike),
            moreExceptionsReduceRisk:sensitivity.filter(x=>x.moreExceptionAppetite<x.fewerExceptionAppetite)
          },
          targetIsolation:{beforeEqual:JSON.stringify(beforeA.risk)===JSON.stringify(beforeB.risk),AChanged:JSON.stringify(beforeA.risk)!==JSON.stringify(afterA.risk),BUnchanged:JSON.stringify(beforeB.risk)===JSON.stringify(afterB.risk),beforeA:beforeA.risk,afterA:afterA.risk,beforeB:beforeB.risk,afterB:afterB.risk},
          naBehavior:{id:naId,beforeRisk:baseNA.risk,afterRisk:afterNA.risk,beforeAssessed:baseNA.assessed,afterAssessed:afterNA.assessed,changed:JSON.stringify(baseNA.risk)!==JSON.stringify(afterNA.risk)},
          emptySharedBehavior:{before:noShared.risk,after:emptyShared.risk,changed:JSON.stringify(noShared.risk)!==JSON.stringify(emptyShared.risk),beforeCommon:noShared.commonCauseDist,afterCommon:emptyShared.commonCauseDist},
          criticality:crit,
          errors:[]
        };
      }"""
    )
    quantile_cases = [(0.72, 5.28), (0.3, 5.7), (1.5, 1.5), (4.72, 35.28), (10.5, 2.5), (50, 50)]
    js_quantiles = page.evaluate(
        "cases=>cases.map(([a,b])=>({a,b,lo:v9betaQuantile(.025,a,b),hi:v9betaQuantile(.975,a,b)}))",
        quantile_cases,
    )
    for row in js_quantiles:
        row["reference_lo"] = float(beta.ppf(0.025, row["a"], row["b"]))
        row["reference_hi"] = float(beta.ppf(0.975, row["a"], row["b"]))
        row["max_error"] = max(abs(row["lo"] - row["reference_lo"]), abs(row["hi"] - row["reference_hi"]))
    result["exactBetaQuantileChecks"] = js_quantiles
    result["browserErrors"] = errors
    browser.close()

OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
summary = {
    "scenario_count": len(result["scenarios"]),
    "mapped_controls": len(result["mapping"]),
    "mapping_errors": len(result["mappingErrors"]),
    "normalization_errors": [s["id"] for s in result["scenarios"] if any(v != 100 for v in s["normalization"].values())],
    "role_mismatches": len(result["roleMismatches"]),
    "mixed_groups": len(result["mixedGroups"]),
    "sensitivity_cases": len(result["sensitivity"]),
    "stronger_increases_risk": len(result["monotonicity"]["strongerIncreasesRisk"]),
    "weaker_reduces_risk": len(result["monotonicity"]["weakerReducesRisk"]),
    "more_exceptions_reduce_risk": len(result["monotonicity"]["moreExceptionsReduceRisk"]),
    "target_isolation": result["targetIsolation"],
    "na_behavior": result["naBehavior"],
    "empty_shared_behavior": result["emptySharedBehavior"],
    "criticality": result["criticality"],
    "max_beta_quantile_error": max(x["max_error"] for x in result["exactBetaQuantileChecks"]),
    "browser_errors": errors,
}
print(json.dumps(summary, indent=2))
if errors:
    raise SystemExit(1)
