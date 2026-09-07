import fs from 'fs';
const target='/home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html';
const modulePath='/home/ubuntu/iopaf_v4/object_risk_v9_module.html';
const correctionPath='/home/ubuntu/iopaf_v4/scoped_register_v9_correction.html';
const workspacePath='/home/ubuntu/iopaf_v4/controls_workspace_v9_redesign.html';
const polishPath='/home/ubuntu/iopaf_v4/controls_workspace_v9_polish.html';
const readabilityPath='/home/ubuntu/iopaf_v4/controls_workspace_v9_readability.html';
const liveRiskPath='/home/ubuntu/iopaf_v4/risk_live_update_v9.html';
const bayesianGraphPath='/home/ubuntu/iopaf_v4/bayesian_graph_v9.html';
const controlsDashboardPath='/home/ubuntu/iopaf_v4/controls_dashboard_v9.html';
const controlTaxonomyDataPath='/home/ubuntu/iopaf_v4/control_taxonomy_data_v9.html';
const controlsDashboardTaxonomyPath='/home/ubuntu/iopaf_v4/controls_dashboard_taxonomy_v9.html';
const remediationActionsPath='/home/ubuntu/iopaf_v4/remediation_actions_v9.html';
const visualPdfReportsPath='/home/ubuntu/iopaf_v4/visual_pdf_reports_v9.html';
const jsPdfPath='/home/ubuntu/iopaf_v4/jspdf.umd.min.js';
let html=fs.readFileSync(target,'utf8');
html=html.replace(/\s*<script id="iopaf-bundled-jspdf">[\s\S]*?<\/script>/g,'');
for(const marker of ['<style id="iopaf-v9-styles">','<style id="iopaf-v9-scoped-styles">','<style id="iopaf-v9-controls-workspace-styles">','<style id="iopaf-v9-controls-polish-styles">','<style id="iopaf-v9-controls-readability-styles">','<style id="iopaf-v9-risk-live-styles">','<style id="iopaf-v9-bn-canvas-styles">','<style id="iopaf-v9-controls-dashboard-styles">','<style id="iopaf-v9-control-taxonomy-data"></style>','<style id="iopaf-v9-controls-taxonomy-styles">','<style id="iopaf-v9-remediation-actions-styles">','<style id="iopaf-v9-visual-pdf-reports-styles">']){
  while(html.includes(marker)){
    const start=html.indexOf(marker);
    const styleEnd=html.indexOf('</style>',start);
    if(styleEnd<0) throw new Error(`Unclosed injected style block: ${marker}`);
    let end=styleEnd+8;
    const next=html.slice(end).match(/^\s*/)[0].length+end;
    if(html.startsWith('<script>',next)){
      const scriptEnd=html.indexOf('</script>',next);
      if(scriptEnd<0) throw new Error(`Unclosed injected script after: ${marker}`);
      end=scriptEnd+9;
    }
    html=html.slice(0,start)+html.slice(end);
  }
}
const module='<script id="iopaf-bundled-jspdf">'+fs.readFileSync(jsPdfPath,'utf8')+'</script>\n'+fs.readFileSync(modulePath,'utf8')+'\n'+fs.readFileSync(correctionPath,'utf8')+'\n'+fs.readFileSync(workspacePath,'utf8')+'\n'+fs.readFileSync(polishPath,'utf8')+'\n'+fs.readFileSync(readabilityPath,'utf8')+'\n'+fs.readFileSync(liveRiskPath,'utf8')+'\n'+fs.readFileSync(bayesianGraphPath,'utf8')+'\n'+fs.readFileSync(controlsDashboardPath,'utf8')+'\n'+fs.readFileSync(controlTaxonomyDataPath,'utf8')+'\n'+fs.readFileSync(controlsDashboardTaxonomyPath,'utf8')+'\n'+fs.readFileSync(remediationActionsPath,'utf8')+'\n'+fs.readFileSync(visualPdfReportsPath,'utf8');
html=html.replace('</body>',module+'\n</body>');
html=html.replace(/consolidates seven control sources[^—]*—[^—]*— into one 148-statement library, with <b style="color:#fff">COBIT 2019<\/b> as the governance overlay\./,'consolidates eight control sources — <b style="color:#fff">ISO/IEC 27002:2022</b>, <b style="color:#fff">ISO/IEC 27001 Annex A</b>, <b style="color:#fff">NIST CSF 2.0</b>, <b style="color:#fff">NIST SP 800&#8209;53 R5</b>, <b style="color:#fff">CIS Controls v8.1</b>, <b style="color:#fff">SCF IAC</b>, <b style="color:#fff">PCI DSS v4.0.1</b> and <b style="color:#fff">COBIT 2019</b> — into one 148-statement library.');
html=html.replaceAll('7 source frameworks','8 source frameworks').replaceAll('drawn from seven source frameworks','drawn from eight source frameworks');
html=html.replace('<div><h2>Maturity dashboard</h2><div class="sub" id="res-sub"></div>','<div><h2>Assessment results</h2><div class="sub" id="res-sub"></div>');
html=html.replace('Rate each control on the same 0&ndash;5 ladder used everywhere in IOPAF; the engine caps unevidenced claims and rolls results up by weight to control group, domain and stream level.','Define the enterprise, shared-service, infrastructure, database, platform, cloud, application, API and network objects in scope. Assess each applicable control for the object where it actually operates; the engine keeps maturity separate from effectiveness, caps unsupported claims, and preserves weak-component risk instead of hiding it in one overall answer.');
fs.writeFileSync(target,html);
console.log(JSON.stringify({target,bytes:Buffer.byteLength(html),moduleBytes:Buffer.byteLength(module),scripts:(html.match(/<script>/g)||[]).length,schema9:html.includes('IOPAF_SCHEMA_VERSION=9')},null,2));
