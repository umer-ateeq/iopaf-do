# IOPAF Visual PDF Reports — Design and Metric Specification

## Purpose and visual doctrine

The redesigned reports will function as **technical assurance dossiers**, not text exports. Every page will follow the same evidence chain: **assessment target → source criteria or controls → evidence and tests → scored interpretation → accountable action**. Deep navy will frame the report, teal will represent assurance and evidence, red will identify gaps, caps, exceptions and residual risk, and amber will be reserved for provisional or unevidenced states.

The PDFs will be generated as native jsPDF vector documents inside the browser. The jsPDF runtime will be embedded into the self-contained portal so the process remains available offline and requires no CDN, external font, image or chart dependency.

## Process-level report architecture

| Page | Technical purpose | Visual components | Data source |
| --- | --- | --- | --- |
| 1. Decision brief | State the defensible current level and whether it is bankable | KPI band, seven-axis spider, L0–L5 maturity ladder, evidence-chain trace, interpretation panel | `procStats`, `DIMS`, scope metadata, standard references |
| 2. Criterion and evidence architecture | Explain why the score has its current shape | Seven-row criterion heatmap, score/coverage/evidence/gap measures, question-score distribution, cap logic | `dimScore`, raw/effective answers, notes, files, `lowQuestions` |
| 3. Findings and technical gaps | Convert weak answers into an auditable gap register | Severity-ranked heat cells, criterion tags, claim-versus-effective comparison, source references, assessor notes | `lowQuestions`, evidence penalty, reference mappings |
| 4. Remediation and next-level path | Define the controlled route to improvement | Next-level delta bars, roadmap sequence, recorded action, ownership, due date and status | `roadmapFor`, practice action record, score thresholds |

The process spider will compare the assessed seven-criterion profile with an explicit **L4 target ring**, rather than using an unsupported industry benchmark. Criterion evidence coverage will be the proportion of answered questions supported by an assessor note or attached evidence file. Gap counts will include effective scores of two or below and high claims reduced by the evidence gate.

## IAM control-domain report architecture

| Page | Technical purpose | Visual components | Data source |
| --- | --- | --- | --- |
| 1. Domain decision brief | Explain the control-domain result for the selected assessment target | KPI band, group spider, L0–L5 ladder, target/control/evidence/risk/action trace | `iamSelectedObject`, applicable controls, target responses, domain groups |
| 2. Control heatmap | Show the complete control estate without flattening weak controls | Group-banded grid of control IDs colored by effective maturity, group averages, evidence-cap markers | target-scoped response records and dashboard result semantics |
| 3. Assurance analytics | Show evidence quality and scientific risk implications | maturity distribution, evidence-strength distribution, tested/exception measures, Bayesian likelihood/consequence/residual-risk distributions | `iamGetResponse`, `iamEffectiveness`, `IOPAF_RISK_LIVE.build` |
| 4+. Technical control register | Preserve detailed auditability | paginated control register with requirement, effective level, evidence, test result, posterior failure and source | IAM control library, detailed guidance, target responses |
| Final. Remediation register | Make closure accountable | structured multi-action table with owner, priority, due, status and completion evidence | `remediationActions[]` / `IOPAF_REMEDIATION` |

The domain report will default to the **currently selected assessment target**. This prevents database, application, infrastructure or shared-IAM evidence from being overwritten by an overall answer. The report will explicitly name the target, object type, environment and criticality. If the domain is not applicable to the selected target, the report will explain that condition rather than displaying a misleading aggregate.

## Metric semantics

| Metric | Definition |
| --- | --- |
| Process criterion score | Mean effective score for answered, applicable questions in the criterion |
| Process evidence coverage | Supported answered questions divided by answered applicable questions; support means a note or attached evidence file |
| Process gap | Effective score ≤2, or a raw 4/5 claim reduced by the evidence gate |
| Target-scoped effective maturity | Recorded maturity after evidence-gate semantics; N/A and unassessed remain distinct from L0 |
| Group/domain mean | Control-weighted mean of target-scoped effective maturity |
| Evidence strength | None, design only, sampled test, measured or continuous evidence from the target response |
| Test exception rate | Observed exceptions divided by tested opportunities, shown only when a test sample exists |
| Posterior control failure | Beta-binomial posterior failure mean and 95% credible range from the existing model |
| Residual risk | Existing Bayesian scenario distribution and appetite exceedance for the domain-mapped scenario and selected target |

## Quality constraints

Every visual must use real assessment data or a clearly labelled internal target. No invented benchmarks, scores or risks will be added. Charts will be drawn with deterministic vector primitives so labels and values remain crisp in the PDF. Each report will include page numbering, generation context, author attribution to **Shabir Murtaza (MSc & PhD – Transformation & Innovation)** and the existing draft-for-review caveat. Pagination will reserve footer space and prevent chart, table-row or heading overflow.
