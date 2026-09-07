import json
from pathlib import Path
from playwright.sync_api import sync_playwright

portal = "file:///home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html"
out = Path("/home/ubuntu/iopaf_v4/visual_pdf_test")
out.mkdir(parents=True, exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: d.accept())
    page.goto(portal, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")

    available = page.evaluate("({jspdf:!!(window.jspdf&&window.jspdf.jsPDF),api:!!window.IOPAF_VISUAL_PDF,process:typeof buildProcPDF,domain:typeof buildIamDomainPDF})")
    assert available == {"jspdf": True, "api": True, "process": "function", "domain": "function"}, available

    # Populate one process with a deliberately varied seven-criterion profile,
    # evidence coverage, evidence-gated claims, findings and a managed action.
    process_index = page.evaluate("""(()=>{
      const idx=P.findIndex(p=>p.id==='inc');
      const p=P[idx],vals=[4,3,2,4,3,2,1];
      scope[p.id]=true;streamMeta.ops.active=true;
      questionsFor(p).forEach((b,di)=>{
        const ids=[qid(p,di,'g'),...b.probes.map((_,k)=>qid(p,di,k))];
        ids.forEach((id,k)=>{answers[id]=Math.max(0,Math.min(5,vals[di]+(k%3===1?1:0)));if((di+k)%2===0)notes[id]='Reviewed operating evidence and sampled execution records.';if((di+k)%5===0)files[id]=[{name:'evidence-'+di+'-'+k+'.pdf',size:12500,type:'application/pdf'}];});
      });
      actions[p.id]={text:'Automate incident severity classification and require post-incident evidence review before closure.',owner:'Service Operations',due:'2027-02-28',status:'progress'};
      persist();return idx;
    })()""")
    process_data = page.evaluate("idx=>{const d=IOPAF_VISUAL_PDF.processData(idx);return {practice:d.p.name,score:d.s.score,level:d.s.level,coverage:d.s.coverage,dimensions:d.byDim.map(x=>({code:x.code,score:x.score,evidence:x.evidence,gaps:x.gaps})),findings:d.lows.length,action:!!d.action};}", process_index)
    assert process_data["practice"] == "Incident Management" and len(process_data["dimensions"]) == 7, process_data
    assert process_data["findings"] > 0 and process_data["action"], process_data
    with page.expect_download() as dl:
        page.evaluate("idx=>downloadProcPDF(idx)", process_index)
    process_pdf = out / "IOPAF-Incident-Management-technical-visual-report.pdf"
    dl.value.save_as(str(process_pdf))

    # Populate a database target across every applicable D3 control with distinct
    # maturity, evidence and test samples; add two target-specific actions.
    target_id = page.evaluate("""(()=>{
      streamMeta.iam.active=true;
      const obj={id:'visual-report-db',name:'Finance Identity Database - Production',type:'database',environment:'Production',criticality:'T1',owner:'Database Platform',provider:'Internal',legacy:false};
      iamObjects.push(obj);iamSelectedObject=obj.id;iamRiskState.objectId=obj.id;
      const ev=['none','design','sampled','measured','continuous'];
      const controls=IAMCTL.filter(c=>c.d==='D3'&&iamControlApplies(c,obj));
      controls.forEach((c,i)=>{
        const maturity=[1,2,3,4,5][i%5],evidence=ev[i%5],tested=i%3===0?30+i:0,exceptions=tested?i%4:0;
        iamObjResponses[iamObjKey(obj.id,c.id)]=Object.assign(iamResponseTemplate(),{implementation:maturity>=4?'meets':maturity>=2?'partially':'does-not-meet',maturity,evidence,totalPaths:4+(i%3),tested,exceptions,note:'Target-scoped evidence reviewed for '+c.id+'.',updated:'2026-08-31T06:00:00.000Z'});
      });
      const first=iamObjResponses[iamObjKey(obj.id,controls[0].id)];
      first.remediationActions=[
        {id:'pdf-a1',description:'Remove the remaining shared administrator credential and enforce unique named access.',owner:'Identity Engineering',due:'2027-01-31',priority:'Critical',status:'In progress',completionEvidence:'',created:'2026-08-31T06:00:00.000Z',updated:'2026-08-31T06:00:00.000Z'},
        {id:'pdf-a2',description:'Re-test emergency access paths after the credential rotation and MFA rollout.',owner:'Database Assurance',due:'2027-02-15',priority:'High',status:'Open',completionEvidence:'Closure requires a zero-exception sample of all emergency paths.',created:'2026-08-31T06:01:00.000Z',updated:'2026-08-31T06:01:00.000Z'}
      ];
      persist();return obj.id;
    })()""")
    domain_data = page.evaluate("id=>{const d=IOPAF_VISUAL_PDF.domainData('D3',id);return {target:d.obj.name,controls:d.rows.length,groups:d.groups.map(g=>({name:g.name,mean:g.mean,gaps:g.gaps})),rated:d.rated,mean:d.mean,maturity:d.maturity,evidence:d.evidence,tested:d.tested,testedTotal:d.testedTotal,exceptions:d.exceptions,risk:d.risk?{scenario:d.scenario.id,distribution:d.risk.risk,appetite:d.risk.appetite}:null,actions:d.actions.length};}", target_id)
    assert domain_data["target"].startswith("Finance Identity Database") and domain_data["controls"] > 10, domain_data
    assert len(domain_data["groups"]) >= 3 and sum(domain_data["maturity"]) == domain_data["rated"], domain_data
    assert domain_data["risk"] and sum(domain_data["risk"]["distribution"]) == 100 and domain_data["actions"] == 2, domain_data
    with page.expect_download() as dl:
        page.evaluate("downloadIamDomainPDF('D3')")
    domain_pdf = out / "IOPAF-IAM-D3-Authentication-finance-identity-database-production-technical-visual-report.pdf"
    dl.value.save_as(str(domain_pdf))

    page.evaluate("go('results');renderResults();resTab(document.querySelector('[data-panel=\"panel-reports\"]'))")
    page.screenshot(path=str(out / "reports-download-centre.png"), full_page=True)
    reports_note = page.evaluate("document.querySelector('#vr-report-note')?.textContent||''")
    assert "Technical visual reports" in reports_note and "OFFLINE ENGINE" in reports_note, reports_note
    browser.close()

assert process_pdf.read_bytes()[:4] == b"%PDF" and process_pdf.stat().st_size > 15000
assert domain_pdf.read_bytes()[:4] == b"%PDF" and domain_pdf.stat().st_size > 25000
report = {
    "embeddedEngine": available,
    "process": process_data,
    "domain": domain_data,
    "files": {"process": {"path": str(process_pdf), "bytes": process_pdf.stat().st_size}, "domain": {"path": str(domain_pdf), "bytes": domain_pdf.stat().st_size}},
    "errors": errors,
}
(out / "visual_pdf_test_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if errors:
    raise SystemExit(1)
