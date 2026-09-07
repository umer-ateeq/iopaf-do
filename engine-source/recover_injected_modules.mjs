import fs from 'node:fs';

const dir='/home/ubuntu/iopaf_v4';
const portal=fs.readFileSync(`${dir}/IOPAF-Assessment-Tool-v1.0.html`,'utf8');
const modules={
  'scoped_register_v9_correction.html':'<style id="iopaf-v9-scoped-styles">',
  'controls_workspace_v9_redesign.html':'<style id="iopaf-v9-controls-workspace-styles">',
  'controls_workspace_v9_polish.html':'<style id="iopaf-v9-controls-polish-styles">',
  'controls_workspace_v9_readability.html':'<style id="iopaf-v9-controls-readability-styles">',
  'risk_live_update_v9.html':'<style id="iopaf-v9-risk-live-styles">',
  'bayesian_graph_v9.html':'<style id="iopaf-v9-bn-canvas-styles">',
  'controls_dashboard_v9.html':'<style id="iopaf-v9-controls-dashboard-styles">',
  'control_taxonomy_data_v9.html':'<style id="iopaf-v9-control-taxonomy-data"></style>',
  'controls_dashboard_taxonomy_v9.html':'<style id="iopaf-v9-controls-taxonomy-styles">',
};

function extractBlock(marker){
  const start=portal.indexOf(marker);
  if(start<0)throw new Error(`Missing marker ${marker}`);
  const styleEnd=portal.indexOf('</style>',start);
  if(styleEnd<0)throw new Error(`Unclosed style ${marker}`);
  let end=styleEnd+8;
  const next=end+(portal.slice(end).match(/^\s*/)?.[0].length||0);
  if(portal.startsWith('<script>',next)){
    const scriptEnd=portal.indexOf('</script>',next);
    if(scriptEnd<0)throw new Error(`Unclosed script after ${marker}`);
    end=scriptEnd+9;
  }
  return portal.slice(start,end).trim()+"\n";
}

for(const [name,marker] of Object.entries(modules)){
  const path=`${dir}/${name}`;
  if(!fs.existsSync(path))fs.writeFileSync(path,extractBlock(marker));
}

const jsStart=portal.indexOf('<script id="iopaf-bundled-jspdf">');
if(jsStart>=0){const jsOpen=portal.indexOf('>',jsStart)+1,jsEnd=portal.indexOf('</script>',jsOpen);if(jsEnd<0)throw new Error('Unclosed embedded jsPDF bundle');if(!fs.existsSync(`${dir}/jspdf.umd.min.js`))fs.writeFileSync(`${dir}/jspdf.umd.min.js`,portal.slice(jsOpen,jsEnd));}

console.log(JSON.stringify({recovered:Object.keys(modules),jspdf:fs.existsSync(`${dir}/jspdf.umd.min.js`)?fs.statSync(`${dir}/jspdf.umd.min.js`).size:0},null,2));
