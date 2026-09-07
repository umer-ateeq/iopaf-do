# IOPAF Engine Source

This directory contains the authoritative modular sources used to assemble and validate the self-contained IOPAF engine distributed at `../client/public/app.html`.

`IOPAF-Assessment-Tool-v1.0.html` is the working assembled portal. The schema-v9 modules implement target-scoped IAM responses, Bayesian risk, focused Controls, the 148-control dashboard, taxonomy, dependencies, remediation and technical visual PDFs. `inject_object_risk_v9.mjs` deterministically embeds those modules and the local `jspdf.umd.min.js` browser library into the standalone HTML.

Run `node test_logic.js` for the deterministic logic regression. The Python browser tests require Playwright and Chromium. The audit Markdown files describe the independently reviewed Bayesian mathematics, Controls workspace and technical PDF rendering.
