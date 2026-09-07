import json
from pathlib import Path
from playwright.sync_api import sync_playwright

url = "file:///home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html"
out = Path("/home/ubuntu/iopaf_v4/v9_browser_shots")
out.mkdir(parents=True, exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: d.accept())

    page.goto(url, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")

    base = page.evaluate("({schema:IOPAF_V9_API.schema,objects:iamObjects.length,controls:IAMCTL.length,domains:IAM_DOMAINS.length,iamActive:streamMeta.iam.active})")
    assert base == {"schema": 9, "objects": 1, "controls": 148, "domains": 8, "iamActive": False}, base
    clean_model_shape = page.evaluate("""(()=>{const m=IOPAF_RISK_LIVE.build('legacy',null,'RSK-GOV-01');return {groups:m.groups.map(g=>({name:g.name,dist:Array.isArray(g.dist),items:g.items.length})),inherent:Array.isArray(m.inh),common:Array.isArray(m.commonCauseDist),like:Array.isArray(m.like),impact:Array.isArray(m.impact),risk:Array.isArray(m.risk)};})()""")
    assert all(x["dist"] for x in clean_model_shape["groups"]) and all(clean_model_shape[k] for k in ("inherent", "common", "like", "impact", "risk")), clean_model_shape

    # Clean state: focused assessment is the default, while the established full
    # register remains available as the alternate view.
    page.evaluate("go('controls');renderControls()")
    page.wait_for_timeout(250)
    clean_controls = page.evaluate("({workspace:!!document.querySelector('.cw-shell'),levels:document.querySelectorAll('.cw-levels button').length,domains:document.querySelectorAll('.cw-domain').length,queue:document.querySelectorAll('.cw-item').length,scale:document.querySelectorAll('.cw-scale button').length,active:streamMeta.iam.active})")
    assert clean_controls["workspace"] and clean_controls["levels"] == 9 and clean_controls["domains"] == 8, clean_controls
    assert clean_controls["queue"] > 0 and clean_controls["scale"] == 7 and clean_controls["active"] is False, clean_controls
    second_domain = page.locator('.cw-domain').nth(1)
    second_domain.focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(100)
    keyboard_domain = page.evaluate("document.querySelector('.cw-domain.on .code')?.textContent.trim()")
    assert keyboard_domain == 'D2', keyboard_domain
    page.evaluate("IOPAF_CONTROLS.domain('D1')")
    page.screenshot(path=str(out / "00-controls-focused-clean.png"), full_page=True)
    page.evaluate("IOPAF_CONTROLS.view('register')")
    page.wait_for_timeout(150)
    full_register = page.evaluate("({rows:document.querySelectorAll('.ctl-r').length,scales:document.querySelectorAll('.ctl-r-scale').length,returnButton:!!document.querySelector('.cw-classic-switch')})")
    assert full_register["rows"] > 0 and full_register["rows"] == full_register["scales"] and full_register["returnButton"], full_register
    page.evaluate("IOPAF_CONTROLS.view('focus')")

    # Clean state: Bayesian Network is visible using priors before setup/evidence.
    page.evaluate("go('results');iamEnsureRiskPanel();resTab(document.querySelector('[data-panel=\"panel-risk\"]'));iamRiskState.view='network';renderBayesianRisk()")
    page.wait_for_timeout(250)
    prior = page.evaluate("({banner:!!document.querySelector('.risk-live-state.prior'),nodes:document.querySelectorAll('.bn-node').length,controlNodes:document.querySelectorAll('.bn-node.control').length,empty:!document.querySelector('#v9-risk-host .bn-node'),confidence:IOPAF_RISK_LIVE.build('legacy',null,'RSK-GOV-01').confidence,scenarios:IOPAF_RISK_LIVE.scenarios.length,appetite:IOPAF_RISK_LIVE.build('legacy',null,'RSK-GOV-01').appetite})")
    assert prior["banner"] and prior["nodes"] >= 10 and not prior["empty"], prior
    assert prior["confidence"] == "Prior only" and prior["scenarios"] == 8, prior
    page.screenshot(path=str(out / "00-bayesian-prior-only.png"), full_page=True)

    # Reproduce the reported behaviour from the visible Controls UI. A D1 control
    # must identify its mapped scenario and update that scenario immediately even
    # while IAM is disabled; the result is clearly labelled WHAT-IF.
    page.evaluate("go('controls');IOPAF_CONTROLS.domain('D1');IOPAF_CONTROLS.control('D1-01')")
    page.wait_for_timeout(150)
    risk_link = page.evaluate("document.querySelector('.risk-impact-link b')?.textContent||''")
    assert "RSK-GOV-01" in risk_link, risk_link
    page.click(".cw-scale button:nth-child(1)")
    page.select_option(".cw-evidence select", "measured")
    evidence_inputs = page.locator(".cw-evidence input")
    evidence_inputs.nth(0).fill("30")
    evidence_inputs.nth(0).press("Tab")
    evidence_inputs.nth(1).fill("30")
    evidence_inputs.nth(1).press("Tab")
    evidence_inputs.nth(2).fill("20")
    evidence_inputs.nth(2).press("Tab")
    page.wait_for_timeout(500)
    gov_after = page.evaluate("(()=>{const m=IOPAF_RISK_LIVE.build('legacy',null,'RSK-GOV-01');return {appetite:m.appetite,assessed:m.assessed,tested:m.tested,whatIf:m.whatIf,last:iamRiskState.lastCalculated};})()")
    assert gov_after["appetite"] != prior["appetite"] and gov_after["assessed"] > 0 and gov_after["tested"] > 0, (prior, gov_after)
    assert gov_after["whatIf"] is True and gov_after["last"], gov_after
    page.click(".risk-impact-link button")
    page.wait_for_timeout(250)
    risk_navigation = page.evaluate("({scenario:iamRiskState.scenario,objectId:iamRiskState.objectId,whatIf:!!document.querySelector('.risk-live-state.whatif'),nodes:document.querySelectorAll('.bn-node').length})")
    assert risk_navigation["scenario"] == "RSK-GOV-01" and risk_navigation["objectId"] == "legacy", risk_navigation
    assert risk_navigation["whatIf"] and risk_navigation["nodes"] >= 10, risk_navigation

    # Enable IAM and create named targets. Answers remain in the established rows.
    page.evaluate("streamMeta.iam.active=true;go('setup')")
    page.fill("#v9-new-name", "Oracle Finance Database — Production")
    page.select_option("#v9-new-type", "database")
    page.select_option("#v9-new-env", "Production")
    page.select_option("#v9-new-tier", "T1")
    page.click("#iam-object-register .btn-primary")
    page.wait_for_timeout(100)

    db_id = page.evaluate("iamObjects.find(o=>o.type==='database'&&!o.legacy)?.id")
    assert db_id, "Database object not created"
    page.evaluate("""id => {
      iamObjects.push({id:'corporate-entra-id',name:'Corporate Entra ID',type:'iam',environment:'Production',criticality:'T1',owner:'Identity Engineering',provider:'Microsoft Entra ID',legacy:false});
      iamSelectedObject=id;iamRiskState.objectId=id;
      const values={
        'D3-05':{implementation:'partially',maturity:3,evidence:'sampled',tested:40,totalPaths:4,exceptions:4,note:'MFA covers CyberArk and the bastion; one password-only emergency path remains.'},
        'D4-13':{implementation:'meets',maturity:4,evidence:'measured',tested:80,totalPaths:6,exceptions:2,note:'Approved roles are enforced; two direct legacy grants remain.'},
        'D5-11':{implementation:'partially',maturity:3,evidence:'sampled',tested:32,totalPaths:4,exceptions:3,note:'JIT is standard; one standing break-glass account remains.'},
        'D5-15':{implementation:'meets',maturity:4,evidence:'measured',tested:48,totalPaths:3,exceptions:1,note:'Privileged sessions are recorded and reviewed.'},
        'D8-05':{implementation:'meets',maturity:4,evidence:'measured',tested:60,totalPaths:5,exceptions:1,note:'SIEM correlation covers database and PAM events.'}
      };
      for(const [cid,v] of Object.entries(values))iamObjResponses[iamObjKey(id,cid)]=Object.assign(iamResponseTemplate(),v,{updated:new Date().toISOString()});
      const shared={
        'D3-05':{implementation:'meets',maturity:4,evidence:'measured',tested:120,totalPaths:8,exceptions:2},
        'D4-13':{implementation:'meets',maturity:4,evidence:'measured',tested:90,totalPaths:7,exceptions:1},
        'D5-11':{implementation:'partially',maturity:3,evidence:'sampled',tested:45,totalPaths:5,exceptions:3}
      };
      for(const [cid,v] of Object.entries(shared))iamObjResponses[iamObjKey('corporate-entra-id',cid)]=Object.assign(iamResponseTemplate(),v,{updated:new Date().toISOString()});
      iamRiskState.scenario='RSK-AUTH-01';iamRiskState.controlsUI={view:'focus',domain:'D3',control:'D3-05',missingEvidence:false};persist();go('controls');renderControls();
    }""", db_id)
    page.wait_for_timeout(400)

    # Use the visible focused L0-L5 controls—not direct state injection—to assess
    # another database control and prove the response is scoped to the target.
    page.evaluate("IOPAF_CONTROLS.control('D3-06')")
    page.click(".cw-scale button:nth-child(3)")
    page.wait_for_timeout(150)
    page.select_option(".cw-evidence select", "design")
    page.wait_for_timeout(150)
    ui_write = page.evaluate("""id => ({
      maturity:iamGetResponse(id,'D3-06').maturity,
      evidence:iamGetResponse(id,'D3-06').evidence,
      overall:iamR['D3-06']===undefined?null:iamR['D3-06']
    })""", db_id)
    assert ui_write == {"maturity": 2, "evidence": "design", "overall": None}, ui_write

    page.evaluate("IOPAF_CONTROLS.control('D3-05')")
    controls = page.evaluate("({object:iamObject(iamSelectedObject).name,level:IOPAF_SCOPE.currentLevel(),domains:document.querySelectorAll('.cw-domain').length,queue:document.querySelectorAll('.cw-item').length,compare:document.querySelectorAll('.cw-compare-row').length,question:document.querySelector('.cw-question b')?.textContent||'',testPanel:!!document.querySelector('.cw-evidence'),posterior:document.querySelector('.cw-posterior strong')?.textContent||''})")
    assert controls["object"].startswith("Oracle Finance") and controls["level"] == "database", controls
    assert controls["domains"] == 8 and controls["queue"] > 0 and controls["compare"] >= 2 and controls["testPanel"], controls
    assert "Oracle Finance Database" in controls["question"] and controls["posterior"].endswith("%"), controls

    # Structured remediation: the focused workspace must support multiple actions
    # with independent ownership, due dates, priority, status and closure evidence.
    remediation_empty = page.evaluate("({workspace:!!document.querySelector('.ra-workspace'),cards:document.querySelectorAll('.ra-card').length,add:!!document.querySelector('.ra-add'),empty:!!document.querySelector('.ra-empty')})")
    assert remediation_empty == {"workspace": True, "cards": 0, "add": True, "empty": True}, remediation_empty
    page.click(".ra-add")
    first = page.locator(".ra-card").nth(0)
    first.locator(".ra-desc textarea").fill("Enforce phishing-resistant MFA on every Oracle Finance administrative path and remove the password-only exception.")
    first.locator(".ra-field input").nth(0).fill("Identity Engineering")
    first.locator(".ra-field input").nth(1).fill("2027-03-31")
    first.locator(".ra-field select").nth(0).select_option("High")
    first.locator(".ra-field select").nth(1).select_option("In progress")
    first.locator(".ra-close textarea").fill("Closure requires a successful test of named, emergency and inherited administrator paths.")
    page.click(".ra-add")
    second = page.locator(".ra-card").nth(1)
    second.locator(".ra-desc textarea").fill("Retire the legacy break-glass bypass after the approved resilient emergency-access route is tested.")
    second.locator(".ra-field input").nth(0).fill("Database Platform")
    second.locator(".ra-field input").nth(1).fill("2027-04-15")
    second.locator(".ra-field select").nth(0).select_option("Critical")
    second.locator(".ra-field select").nth(1).select_option("Blocked")
    page.wait_for_timeout(200)
    remediation_two = page.evaluate("""id=>{const r=iamGetResponse(id,'D3-05'),overall=iamGetResponse('legacy','D3-05');return {count:r.remediationActions.length,descriptions:r.remediationActions.map(a=>a.description),priorities:r.remediationActions.map(a=>a.priority),statuses:r.remediationActions.map(a=>a.status),legacyMirror:r.action,overallCount:(overall.remediationActions||[]).length};}""", db_id)
    assert remediation_two["count"] == 2 and remediation_two["priorities"] == ["High", "Critical"], remediation_two
    assert remediation_two["statuses"] == ["In progress", "Blocked"] and remediation_two["overallCount"] == 0, remediation_two
    assert remediation_two["legacyMirror"].startswith("Enforce phishing-resistant MFA"), remediation_two

    # Duplicate, delete and complete actions through the visible controls.
    second.get_by_text("Duplicate", exact=True).click()
    page.wait_for_timeout(100)
    assert page.locator(".ra-card").count() == 3
    page.locator(".ra-card").nth(2).get_by_text("Delete", exact=True).click()
    page.wait_for_timeout(100)
    assert page.locator(".ra-card").count() == 2
    page.locator(".ra-card").nth(0).get_by_text("Mark complete", exact=True).click()
    page.wait_for_timeout(100)
    remediation_lifecycle = page.evaluate("id=>iamGetResponse(id,'D3-05').remediationActions.map(a=>({description:a.description,status:a.status,completionEvidence:a.completionEvidence}))", db_id)
    assert remediation_lifecycle[0]["status"] == "Completed" and remediation_lifecycle[1]["status"] == "Blocked", remediation_lifecycle

    # Persist, reload and prove the two target-specific action records survive.
    page.wait_for_timeout(700)
    page.reload(wait_until="load")
    page.evaluate("id=>{iamSelectedObject=id;iamRiskState.objectId=id;iamRiskState.controlsUI={view:'focus',domain:'D3',control:'D3-05',missingEvidence:false};go('controls');renderControls();}", db_id)
    page.wait_for_timeout(250)
    persisted_actions = page.evaluate("id=>iamGetResponse(id,'D3-05').remediationActions.map(a=>a.status)", db_id)
    assert persisted_actions == ["Completed", "Blocked"] and page.locator(".ra-card").count() == 2, persisted_actions

    # Results Actions must include every structured IAM action and export them one
    # row per action rather than flattening the list to one note.
    page.evaluate("go('results');renderResults();resTab(document.querySelector('[data-panel=\"panel-actions\"]'));renderActions()")
    page.wait_for_timeout(150)
    remediation_results = page.evaluate("({register:!!document.querySelector('#iam-remediation-register'),rows:document.querySelectorAll('#iam-remediation-register tbody tr').length,text:document.querySelector('#iam-remediation-register')?.textContent||''})")
    assert remediation_results["register"] and remediation_results["rows"] == 2, remediation_results
    assert "Identity Engineering" in remediation_results["text"] and "Database Platform" in remediation_results["text"], remediation_results
    with page.expect_download() as dl:
        page.evaluate("IOPAF_REMEDIATION.exportCSV()")
    remediation_csv = out / "IOPAF-IAM-remedial-actions.csv"
    dl.value.save_as(str(remediation_csv))
    remediation_lines = remediation_csv.read_text(encoding="utf-8-sig").splitlines()
    assert len(remediation_lines) == 3 and "Completion evidence" in remediation_lines[0], remediation_lines[:3]

    page.evaluate("resTab(document.querySelector('[data-panel=\"panel-reports\"]'))")
    remediation_report = page.evaluate("({card:!!document.querySelector('#rep-iam-remediation'),text:document.querySelector('#rep-iam-remediation')?.textContent||''})")
    assert remediation_report["card"] and "2 actions currently recorded" in remediation_report["text"], remediation_report
    with page.expect_download() as dl:
        page.evaluate("exportJSON()")
    remediation_backup = out / "IOPAF-remediation-roundtrip.json"
    dl.value.save_as(str(remediation_backup))
    remediation_payload = json.loads(remediation_backup.read_text(encoding="utf-8"))
    backup_actions = remediation_payload["iamObjResponses"][f"{db_id}|D3-05"]["remediationActions"]
    assert len(backup_actions) == 2 and backup_actions[0]["completionEvidence"], backup_actions

    # Alter only the in-memory action list, then import the backup through the real
    # FileReader path to prove the structured arrays are restored unchanged.
    page.evaluate("id=>{iamObjResponses[iamObjKey(id,'D3-05')].remediationActions=[];persist();const i=document.createElement('input');i.type='file';i.id='remediation-import-test';document.body.appendChild(i);}", db_id)
    page.locator("#remediation-import-test").set_input_files(str(remediation_backup))
    page.evaluate("importJSON(document.getElementById('remediation-import-test'))")
    page.wait_for_timeout(900)
    imported_actions = page.evaluate("id=>iamGetResponse(id,'D3-05').remediationActions.map(a=>a.status)", db_id)
    assert imported_actions == ["Completed", "Blocked"], imported_actions
    page.evaluate("id=>{iamSelectedObject=id;iamRiskState.objectId=id;iamRiskState.controlsUI={view:'focus',domain:'D3',control:'D3-05',missingEvidence:false};go('controls');renderControls();}", db_id)
    page.wait_for_timeout(150)
    page.screenshot(path=str(out / "01-controls-focused-workspace.png"), full_page=True)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(100)
    page.screenshot(path=str(out / "01-controls-readable-viewport.png"), full_page=False)
    controls_overflow = page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    assert controls_overflow <= 1, controls_overflow
    readable_sizes = page.evaluate("""(()=>{const px=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);return {domain:px('.cw-domain b'),control:px('.cw-item p'),question:px('.cw-question b'),field:px('.cw-field select'),guidance:px('.cw-req p'),traceValue:px('.cw-trace-node b'),traceLabel:px('.cw-trace-node label'),comparison:px('.cw-compare-row')};})()""")
    assert readable_sizes["domain"] >= 11 and readable_sizes["control"] >= 11, readable_sizes
    assert readable_sizes["question"] >= 13 and readable_sizes["field"] >= 11, readable_sizes
    assert readable_sizes["guidance"] >= 10.5 and readable_sizes["traceValue"] >= 10, readable_sizes
    assert readable_sizes["traceLabel"] >= 8 and readable_sizes["comparison"] >= 9.5, readable_sizes

    # Standard laptop viewport at 100% browser zoom.
    page.set_viewport_size({"width": 1366, "height": 768})
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(150)
    laptop_overflow = page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    assert laptop_overflow <= 1, laptop_overflow
    page.screenshot(path=str(out / "01a-controls-readable-laptop.png"), full_page=False)

    # Responsive workspace check.
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(150)
    mobile_overflow = page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    mobile_wide = page.evaluate("""[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,cls:el.className||'',id:el.id||'',left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scroll:el.scrollWidth};}).filter(x=>x.right>392||x.width>392).sort((a,b)=>b.right-a.right).slice(0,20)""")
    if mobile_overflow > 1:
        print(json.dumps({"mobileOverflow": mobile_overflow, "wideElements": mobile_wide}, indent=2))
    assert mobile_overflow <= 1, mobile_overflow
    page.screenshot(path=str(out / "01b-controls-focused-mobile.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 1000})

    # Holistic Results Controls Dashboard: all 148 controls, deterministic
    # classification, effective maturity, target selector, filters and drill-through.
    page.evaluate("go('results');renderResults();const b=document.querySelector('[data-panel=\"panel-controls-dashboard\"]');resTab(b);IOPAF_DASH.render()")
    page.wait_for_timeout(250)
    dashboard = page.evaluate("""(()=>{const tiles=[...document.querySelectorAll('.cd-tile')],classes=tiles.reduce((a,x)=>(a[x.dataset.class]=(a[x.dataset.class]||0)+1,a),{}),levels=tiles.reduce((a,x)=>(a[x.dataset.maturity]=(a[x.dataset.maturity]||0)+1,a),{}),d305=document.querySelector('.cd-tile[data-id="D3-05"]');return {tiles:tiles.length,domains:document.querySelectorAll('.cd-domain').length,groups:document.querySelectorAll('.cd-group').length,classes,levels,targetOptions:document.querySelectorAll('.cd-target option').length,d305:d305?.textContent||'',method:document.querySelector('#cd-method')?.textContent||'',visible:Number(document.querySelector('#cd-visible')?.textContent||0),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()""")
    assert dashboard["tiles"] == 148 and dashboard["domains"] == 8 and dashboard["groups"] == 32, dashboard
    assert dashboard["classes"] == {"Critical": 74, "Core": 33, "Non-critical": 41}, dashboard
    assert "L3" in dashboard["d305"] and "Evidenced" in dashboard["d305"] and "CRITICAL" in dashboard["d305"], dashboard
    assert "Non-critical means lower relative priority" in dashboard["method"] and dashboard["overflow"] <= 1, dashboard
    dashboard_sizes = page.evaluate("""(()=>{const px=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);return {name:px('.cd-name'),id:px('.cd-id'),class:px('.cd-class'),level:px('.cd-tile[data-id="D3-05"] .cd-level'),filter:px('.cd-filter select')};})()""")
    assert dashboard_sizes["name"] >= 10 and dashboard_sizes["id"] >= 9 and dashboard_sizes["class"] >= 7, dashboard_sizes
    assert dashboard_sizes["level"] >= 20 and dashboard_sizes["filter"] >= 10, dashboard_sizes
    taxonomy = page.evaluate("""(()=>{const tiles=[...document.querySelectorAll('.cd-tile')],count=k=>tiles.reduce((a,x)=>(a[x.dataset[k]]=(a[x.dataset[k]]||0)+1,a),{}),d305=document.querySelector('.cd-tile[data-id="D3-05"]');return {types:count('type'),hierarchies:count('hierarchy'),effects:count('effect'),d305:d305?.textContent||'',summary:document.querySelector('.ctax-summary')?.textContent||'',api:!!window.IOPAF_DASH_TAX,edges:window.IOPAF_CONTROL_TAXONOMY?.edges.length};})()""")
    assert taxonomy["types"] == {"Preventive": 76, "Directive": 13, "Compensating": 1, "Detective": 50, "Corrective": 8}, taxonomy
    assert taxonomy["hierarchies"] == {"Administrative": 78, "Engineering": 64, "Substitution": 4, "Elimination": 2}, taxonomy
    assert taxonomy["effects"] == {"Both": 13, "Likelihood": 104, "Consequence": 31}, taxonomy
    assert taxonomy["api"] and taxonomy["edges"] == 202 and "CONTROL TYPE" in taxonomy["d305"] and "RISK EFFECT" in taxonomy["d305"], taxonomy
    page.evaluate("IOPAF_DASH_TAX.filter('type','Preventive')")
    page.wait_for_timeout(80)
    type_filtered = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),all:[...document.querySelectorAll('.cd-tile:not([hidden])')].every(x=>x.dataset.type==='Preventive')})")
    assert type_filtered == {"visible": 76, "all": True}, type_filtered
    page.evaluate("IOPAF_DASH.reset()")
    page.wait_for_timeout(80)
    page.evaluate("IOPAF_DASH_TAX.filter('hierarchy','Engineering')")
    page.wait_for_timeout(80)
    hierarchy_filtered = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),all:[...document.querySelectorAll('.cd-tile:not([hidden])')].every(x=>x.dataset.hierarchy==='Engineering')})")
    assert hierarchy_filtered == {"visible": 64, "all": True}, hierarchy_filtered
    page.evaluate("IOPAF_DASH.reset()")
    page.wait_for_timeout(80)
    page.evaluate("IOPAF_DASH_TAX.filter('effect','Both')")
    page.wait_for_timeout(80)
    effect_filtered = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),all:[...document.querySelectorAll('.cd-tile:not([hidden])')].every(x=>x.dataset.effect==='Both')})")
    assert effect_filtered == {"visible": 13, "all": True}, effect_filtered
    page.evaluate("IOPAF_DASH.reset()")
    page.wait_for_timeout(80)
    page.evaluate("IOPAF_DASH.filter('cls','Critical')")
    dashboard_critical = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),shown:document.querySelectorAll('.cd-tile:not([hidden])').length,other:[...document.querySelectorAll('.cd-tile:not([hidden])')].some(x=>x.dataset.class!=='Critical')})")
    assert dashboard_critical == {"visible": 74, "shown": 74, "other": False}, dashboard_critical
    page.evaluate("IOPAF_DASH.reset()")
    page.evaluate("IOPAF_DASH.filter('evidence','evidenced')")
    dashboard_evidenced = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),all:[...document.querySelectorAll('.cd-tile:not([hidden])')].every(x=>x.dataset.evidence==='evidenced')})")
    assert dashboard_evidenced == {"visible": 6, "all": True}, dashboard_evidenced
    page.evaluate("IOPAF_DASH.reset();IOPAF_DASH.filter('maturity','L3')")
    dashboard_l3 = page.evaluate("({visible:Number(document.querySelector('#cd-visible').textContent),all:[...document.querySelectorAll('.cd-tile:not([hidden])')].every(x=>x.dataset.maturity==='L3')})")
    assert dashboard_l3 == {"visible": 2, "all": True}, dashboard_l3
    page.evaluate("IOPAF_DASH.reset()")
    page.select_option('.cd-target select', 'corporate-entra-id')
    page.wait_for_timeout(80)
    dashboard_shared_target = page.evaluate("document.querySelector('.cd-tile[data-id=\"D3-05\"]')?.textContent||''")
    assert "L4" in dashboard_shared_target and "Evidenced" in dashboard_shared_target, dashboard_shared_target
    page.select_option('.cd-target select', db_id)
    page.wait_for_timeout(80)
    page.screenshot(path=str(out / "05-controls-dashboard.png"), full_page=True)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(80)
    page.screenshot(path=str(out / "05a-controls-dashboard-viewport.png"), full_page=False)
    page.locator('.cd-domain[data-domain-section="D3"]').screenshot(path=str(out / "05b-controls-dashboard-domain.png"))
    page.evaluate("IOPAF_DASH_TAX.select('D3-05')")
    page.wait_for_timeout(120)
    dependency = page.evaluate("""(()=>{const s=iamRiskState.controlTaxonomyDashboard,focus=document.querySelector('.ctax-focus')?.textContent||'',up=document.querySelectorAll('.ctax-lane:first-of-type .ctax-node').length,lanes=[...document.querySelectorAll('.ctax-lane .ctax-node')].length,meta=IOPAF_CONTROL_TAXONOMY.controls[s.selected];return {view:s.view,selected:s.selected,depth:s.depth,focus,upstream:meta.upstream.length,downstream:meta.downstream.length,nodes:lanes,mode:document.querySelector('.cd-shell')?.classList.contains('ctax-dependency-mode'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()""")
    assert dependency["view"] == "dependencies" and dependency["selected"] == "D3-05" and dependency["depth"] == 1, dependency
    assert dependency["mode"] and dependency["nodes"] == dependency["upstream"] + dependency["downstream"] and "RSK-AUTH-01" in dependency["focus"] and dependency["overflow"] <= 1, dependency
    page.screenshot(path=str(out / "06-control-interdependencies.png"), full_page=True)
    page.evaluate("IOPAF_DASH_TAX.depth(2)")
    page.wait_for_timeout(100)
    extended_nodes = page.locator('.ctax-node').count()
    assert extended_nodes > dependency["nodes"], {"immediate": dependency["nodes"], "extended": extended_nodes}
    first_dependency = page.locator('.ctax-node').first
    first_id = first_dependency.locator('.ctax-node-id').inner_text()
    first_dependency.focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(100)
    assert page.evaluate("iamRiskState.controlTaxonomyDashboard.selected") == first_id, first_id
    page.evaluate("IOPAF_DASH_TAX.select('D3-05');IOPAF_DASH_TAX.depth(1)")
    page.wait_for_timeout(80)
    with page.expect_download() as tax_dl:
        page.evaluate("IOPAF_DASH_TAX.exportCSV()")
    taxonomy_csv = out / "IOPAF-control-taxonomy-dependencies.csv"
    tax_dl.value.save_as(str(taxonomy_csv))
    assert taxonomy_csv.stat().st_size > 15000, taxonomy_csv.stat().st_size
    page.evaluate("IOPAF_DASH_TAX.view('estate')")
    page.wait_for_timeout(100)
    deep = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    deep_errors = []
    deep.on("pageerror", lambda e: deep_errors.append(str(e)))
    deep.goto(url + "?view=controls-dashboard&map=1&control=D3-05", wait_until="load")
    deep.wait_for_timeout(350)
    deep_state = deep.evaluate("({view:iamRiskState.controlTaxonomyDashboard?.view,selected:iamRiskState.controlTaxonomyDashboard?.selected,map:!!document.querySelector('.ctax-map'),focus:document.querySelector('.ctax-focus-id')?.textContent.trim()||'',errors:document.querySelectorAll('.error').length})")
    assert deep_state["view"] == "dependencies" and deep_state["selected"] == "D3-05" and deep_state["map"] and deep_state["focus"] == "D3-05" and not deep_errors, {"state": deep_state, "errors": deep_errors}
    deep.close()
    dashboard_tile = page.locator('.cd-tile[data-id="D3-05"]')
    dashboard_tile.focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(180)
    dashboard_drill = page.evaluate("({view:document.querySelector('.view.on')?.id,control:iamRiskState.controlsUI.control,domain:iamRiskState.controlsUI.domain,object:iamSelectedObject,workspace:!!document.querySelector('.cw-shell')})")
    assert dashboard_drill["view"] == "view-controls" and dashboard_drill["control"] == "D3-05" and dashboard_drill["domain"] == "D3" and dashboard_drill["object"] == db_id and dashboard_drill["workspace"], dashboard_drill
    page.evaluate("go('results');renderResults();const b=document.querySelector('[data-panel=\"panel-controls-dashboard\"]');resTab(b);IOPAF_DASH.render()")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(120)
    dashboard_mobile = page.evaluate("({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,tiles:document.querySelectorAll('.cd-tile').length,columns:getComputedStyle(document.querySelector('.cd-grid')).gridTemplateColumns,target:!!document.querySelector('.cd-target select')})")
    assert dashboard_mobile["overflow"] <= 1 and dashboard_mobile["tiles"] == 148 and dashboard_mobile["target"], dashboard_mobile
    page.screenshot(path=str(out / "05m-controls-dashboard-mobile.png"), full_page=True)
    page.evaluate("window.scrollTo(0,0)")
    page.screenshot(path=str(out / "05ma-controls-dashboard-mobile-viewport.png"), full_page=False)
    page.evaluate("IOPAF_DASH_TAX.select('D3-05')")
    page.wait_for_timeout(100)
    dependency_mobile = page.evaluate("({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,focus:!!document.querySelector('.ctax-focus'),nodes:document.querySelectorAll('.ctax-node').length,columns:getComputedStyle(document.querySelector('.ctax-graph')).display})")
    assert dependency_mobile["overflow"] <= 1 and dependency_mobile["focus"] and dependency_mobile["nodes"] > 0, dependency_mobile
    page.screenshot(path=str(out / "06m-control-interdependencies-mobile.png"), full_page=True)
    page.evaluate("IOPAF_DASH_TAX.view('estate')")
    page.set_viewport_size({"width": 1440, "height": 1000})

    with page.expect_download() as dl:
        page.evaluate("iamExportObjectCSV()")
    object_csv = out / "IOPAF-IAM-object-assurance.csv"
    dl.value.save_as(str(object_csv))
    assert object_csv.stat().st_size > 10000, object_csv.stat().st_size

    page.evaluate("go('results');iamEnsureRiskPanel();resTab(document.querySelector('[data-panel=\"panel-risk\"]'));iamRiskState.view='summary';renderBayesianRisk();")
    page.wait_for_timeout(150)
    page.screenshot(path=str(out / "02-risk-summary.png"), full_page=True)
    summary = page.evaluate("""(()=>{const m=iamBuildRiskModel(iamRiskState.objectId);return {like:m.like,impact:m.impact,risk:m.risk,appetite:m.appetite,appetiteLimit:m.appetiteLimit,appetiteBreached:m.appetiteBreached,assessed:m.assessed,tested:m.tested,text:document.querySelector('#v9-risk-host')?.textContent||''};})()""")
    for key in ("like", "impact", "risk"):
        assert sum(summary[key]) == 100, (key, summary[key])
    assert summary["appetiteLimit"] is None and summary["appetiteBreached"] is None and "No approved organizational appetite limit" in summary["text"], summary

    page.evaluate("iamRiskState.view='network';renderBayesianRisk()")
    page.wait_for_timeout(150)
    page.screenshot(path=str(out / "03-bayesian-network.png"), full_page=True)
    network = page.evaluate("""(()=>{const nodes=[...document.querySelectorAll('.bn-node')],sums=nodes.filter(n=>n.querySelector('.bn-state')).map(n=>[...n.querySelectorAll('.bn-state b')].reduce((a,x)=>a+(parseInt(x.textContent)||0),0)),vp=getComputedStyle(document.querySelector('.bn-viewport'));return {nodes:nodes.length,controls:document.querySelectorAll('.bn-node.control').length,groups:document.querySelectorAll('.bn-node.group').length,expanders:document.querySelectorAll('.bn-expand').length,edges:document.querySelectorAll('.bn-edge').length,stateRows:document.querySelectorAll('.bn-state').length,probabilitySums:sums,labels:[...document.querySelectorAll('.bn-node-hd b')].map(x=>x.textContent),scenario:iamRiskState.scenario,zoom:IOPAF_BN.state.zoom,background:vp.backgroundImage};})()""")
    assert network["nodes"] == 11 and network["controls"] == 0 and network["groups"] == 4 and network["expanders"] == 4, network
    assert network["edges"] >= network["groups"] + 6 and all(x == 100 for x in network["probabilitySums"]), network
    assert network["background"] == "none", network
    assert network["scenario"] == "RSK-AUTH-01", network
    page.locator('.bn-expand').first.click()
    page.wait_for_timeout(80)
    expanded_group = page.evaluate("({controls:document.querySelectorAll('.bn-node.control').length,expanded:IOPAF_BN.state.expanded.size,controlEdges:document.querySelectorAll('.bn-edge[data-from^=\"ctl-\"]').length})")
    assert expanded_group["controls"] > 0 and expanded_group["expanded"] == 1 and expanded_group["controlEdges"] == expanded_group["controls"], expanded_group
    page.screenshot(path=str(out / "03a-bayesian-group-expanded.png"), full_page=True)
    page.locator('.bn-node.control').first.click()
    inspector = page.evaluate("({selected:IOPAF_BN.state.selected,text:document.querySelector('#bn-inspector')?.textContent||''})")
    assert inspector["selected"].startswith('ctl-') and 'posterior failure' in inspector["text"], inspector
    page.evaluate("IOPAF_BN.select('bar-det')")
    trace = page.evaluate("({incoming:document.querySelectorAll('.bn-edge.trace[data-to=\"bar-det\"]').length,outgoing:document.querySelectorAll('.bn-edge.trace[data-from=\"bar-det\"]').length,muted:document.querySelectorAll('.bn-edge.muted').length,selected:IOPAF_BN.state.selected})")
    assert trace["selected"] == "bar-det" and trace["incoming"] >= 0 and trace["outgoing"] == 1 and trace["muted"] > 0, trace
    page.screenshot(path=str(out / "03t-bayesian-detection-trace.png"), full_page=True)
    page.evaluate("IOPAF_BN.clear()")
    page.evaluate("IOPAF_BN.mode('full')")
    page.wait_for_timeout(100)
    full_graph = page.evaluate("({controls:document.querySelectorAll('.bn-node.control').length,collapsed:document.querySelectorAll('.bn-node.collapsed').length,nodes:document.querySelectorAll('.bn-node').length,edges:document.querySelectorAll('.bn-edge').length})")
    assert full_graph["controls"] == 18 and full_graph["collapsed"] == 0 and full_graph["nodes"] > network["nodes"], full_graph
    page.screenshot(path=str(out / "03c-bayesian-network-full.png"), full_page=True)
    page.evaluate("IOPAF_BN.fit()")
    page.wait_for_timeout(100)
    graph_controls = page.evaluate("({mode:IOPAF_BN.state.mode,zoom:IOPAF_BN.state.zoom,label:document.querySelector('#bn-zoom-label')?.textContent||'',viewport:!!document.querySelector('#bn-viewport')})")
    assert graph_controls["mode"] == 'full' and graph_controls["zoom"] >= .32 and graph_controls["viewport"], graph_controls
    network_overflow = page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    assert network_overflow <= 1, network_overflow

    # Every domain scenario must render a coherent compact and expanded graph.
    all_scenario_graphs = {}
    scenario_ids = page.evaluate("IOPAF_RISK_LIVE.scenarios.map(s=>s.id)")
    for scenario_id in scenario_ids:
        page.evaluate("id=>{iamRiskState.scenario=id;IOPAF_BN.state.mode='full';renderBayesianRisk()}", scenario_id)
        page.wait_for_timeout(30)
        full_stats = page.evaluate("""(()=>{const m=IOPAF_RISK_LIVE.build(iamRiskState.objectId,null,iamRiskState.scenario),nodes=Object.values(IOPAF_BN.state.nodes),pairs=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(w>1&&h>1)pairs.push(a.id+'|'+b.id);}const sums=[...document.querySelectorAll('.bn-node')].filter(n=>n.querySelector('.bn-state')).map(n=>[...n.querySelectorAll('.bn-state b')].reduce((a,x)=>a+(parseInt(x.textContent)||0),0));return {mapped:m.controlsCount,controlNodes:document.querySelectorAll('.bn-node.control').length,groups:m.groups.length,groupNodes:document.querySelectorAll('.bn-node.group').length,edges:document.querySelectorAll('.bn-edge').length,sums,overlaps:pairs};})()""")
        assert full_stats["controlNodes"] == full_stats["mapped"] and full_stats["groupNodes"] == full_stats["groups"], (scenario_id, full_stats)
        assert all(x == 100 for x in full_stats["sums"]) and not full_stats["overlaps"], (scenario_id, full_stats)
        page.evaluate("IOPAF_BN.mode('compact')")
        page.wait_for_timeout(20)
        compact_stats = page.evaluate("({controls:document.querySelectorAll('.bn-node.control').length,groups:document.querySelectorAll('.bn-node.group').length,expanders:document.querySelectorAll('.bn-expand').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})")
        assert compact_stats["controls"] == 0 and compact_stats["groups"] == full_stats["groups"] and compact_stats["expanders"] == full_stats["groups"] and compact_stats["overflow"] <= 1, (scenario_id, compact_stats)
        page.evaluate("IOPAF_BN.toggle(0)")
        page.wait_for_timeout(20)
        one_group = page.evaluate("""(()=>{const m=IOPAF_RISK_LIVE.build(iamRiskState.objectId,null,iamRiskState.scenario),controls=document.querySelectorAll('.bn-node.control').length,edges=document.querySelectorAll('.bn-edge[data-from^="ctl-"]').length;return {controls,edges,expected:m.groups[0].items.length,expanded:IOPAF_BN.state.expanded.size};})()""")
        assert one_group["controls"] == one_group["expected"] and one_group["edges"] == one_group["controls"] and one_group["expanded"] == 1, (scenario_id, one_group)
        all_scenario_graphs[scenario_id] = {"full": full_stats, "compact": compact_stats}

    page.evaluate("iamRiskState.scenario='RSK-AUTH-01';IOPAF_BN.state.mode='compact';renderBayesianRisk()")

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(80)
    mobile_network = page.evaluate("({pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,viewport:!!document.querySelector('#bn-viewport'),internalScroll:(document.querySelector('#bn-viewport')?.scrollWidth||0)>(document.querySelector('#bn-viewport')?.clientWidth||0),nodes:document.querySelectorAll('.bn-node').length,tools:document.querySelectorAll('.bn-tools button').length,chain:['html','body','#view-results','.res-wrap','#panel-risk','#v9-risk-host','.bn-shell','#bn-viewport','#bn-stage'].map(s=>{const el=document.querySelector(s),r=el?.getBoundingClientRect();return {s,width:Math.round(r?.width||0),right:Math.round(r?.right||0),client:el?.clientWidth||0,scroll:el?.scrollWidth||0,overflow:el?getComputedStyle(el).overflowX:''};}),wide:[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id||'',cls:String(el.className||'').slice(0,80),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scroll:el.scrollWidth};}).filter(x=>x.right>392||x.width>392).sort((a,b)=>b.right-a.right).slice(0,20)})")
    page.screenshot(path=str(out / "03m-bayesian-network-mobile.png"), full_page=True)
    assert mobile_network["pageOverflow"] <= 1 and mobile_network["viewport"] and mobile_network["internalScroll"] and mobile_network["nodes"] >= 11 and mobile_network["tools"] >= 6, mobile_network
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.evaluate("renderBayesianRisk()")
    page.wait_for_timeout(60)

    page.evaluate("iamRiskState.view='register';renderBayesianRisk()")
    page.wait_for_timeout(100)
    risk_register = page.evaluate("({rows:document.querySelectorAll('.risk-register-live tbody tr').length,selected:document.querySelector('.risk-register-live tr.on code')?.textContent||'',statuses:[...document.querySelectorAll('.risk-register-live tbody tr td:last-child')].map(x=>x.textContent.trim())})")
    assert risk_register["rows"] == 8 and risk_register["selected"] == "RSK-AUTH-01", risk_register
    assert any(x in ("Live", "What-if") for x in risk_register["statuses"]), risk_register
    page.screenshot(path=str(out / "03b-risk-register-live.png"), full_page=True)

    page.evaluate("iamRiskState.view='evidence';renderBayesianRisk()")
    page.screenshot(path=str(out / "04-model-evidence.png"), full_page=True)
    with page.expect_download() as dl:
        page.evaluate("iamExportRiskJSON()")
    risk_json = out / "IOPAF-RSK-AUTH-01-risk.json"
    dl.value.save_as(str(risk_json))
    risk_payload = json.loads(risk_json.read_text(encoding="utf-8"))
    assert sum(risk_payload["riskDistribution"]) == 100 and risk_payload["mappedControlCount"] > 5
    page.wait_for_timeout(650)
    saved = page.evaluate("JSON.parse(localStorage.getItem('iopaf-v4-state'))")
    assert saved["v"] == 9 and saved.get("iamObjects") and saved.get("iamObjResponses"), saved.keys()
    duplicate_ids = page.evaluate("""(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id).filter(id=>id.startsWith('v9')||id==='panel-risk'||id==='iam-object-register'),seen=new Set();return ids.filter(id=>seen.has(id)||!seen.add(id));})()""")
    assert not duplicate_ids, duplicate_ids
    browser.close()

report = {
    "base": base,
    "cleanControls": clean_controls,
    "fullRegister": full_register,
    "keyboardDomainNavigation": keyboard_domain,
    "priorNetwork": prior,
    "governanceWhatIfUpdate": gov_after,
    "controlToRiskNavigation": risk_navigation,
    "dbId": db_id,
    "controls": controls,
    "existingFormScopedWrite": ui_write,
    "remediation": {
        "emptyWorkspace": remediation_empty,
        "twoActions": remediation_two,
        "lifecycle": remediation_lifecycle,
        "persistedStatuses": persisted_actions,
        "resultsRegister": remediation_results,
        "reportsEntry": remediation_report,
        "importedStatuses": imported_actions,
    },
    "summary": summary,
    "network": network,
    "nodeInspector": inspector,
    "fullGraph": full_graph,
    "graphControls": graph_controls,
    "allScenarioGraphs": all_scenario_graphs,
    "riskRegister": risk_register,
    "controlsDashboard": dashboard,
    "controlsDashboardCriticalFilter": dashboard_critical,
    "controlsDashboardEvidencedFilter": dashboard_evidenced,
    "controlsDashboardL3Filter": dashboard_l3,
    "controlsDashboardSharedTargetD305": dashboard_shared_target,
    "controlsDashboardDrillThrough": dashboard_drill,
    "controlsDashboardReadableSizesPx": dashboard_sizes,
    "controlsDashboardMobile": dashboard_mobile,
    "readableSizesPx": readable_sizes,
    "layout": {"controlsPageOverflowPx": controls_overflow, "controlsLaptopOverflowPx": laptop_overflow, "controlsMobileOverflowPx": mobile_overflow, "networkPageOverflowPx": network_overflow, "networkMobile": mobile_network, "duplicateIds": duplicate_ids},
    "exports": {"objectCsvBytes": object_csv.stat().st_size, "riskJsonBytes": risk_json.stat().st_size, "remediationCsvBytes": remediation_csv.stat().st_size, "remediationBackupBytes": remediation_backup.stat().st_size},
    "saved": {"v": saved["v"], "objects": len(saved["iamObjects"]), "responses": len(saved["iamObjResponses"])},
    "errors": errors,
}
Path("/home/ubuntu/iopaf_v4/v9_browser_test_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if errors:
    raise SystemExit(1)
