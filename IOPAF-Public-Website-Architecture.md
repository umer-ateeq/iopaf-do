# IOPAF Public Website Architecture

## Purpose

The public page must explain **what the IOPAF engine does, how its conclusions are formed, and what users receive** before presenting secure access. It sits above the existing engine and must not imitate or replace the engine interface.

## Narrative

| Chapter | Question answered | Visual system |
| --- | --- | --- |
| 01 — Executive proposition | Why does IOPAF exist? | Large assurance map from decision target to accountable action, supported by coverage metrics. |
| 02 — End-to-end journey | Where does the assessment operate? | Nine-stage ideation-to-operation rail with Development, Testing, Operations and IAM overlays. |
| 03 — Three assurance streams | What is assessed? | Three parallel evidence lanes with scope, governing sources and outputs. |
| 04 — Standards architecture | How do fourteen standards relate? | Standards-to-engine matrix grouped by lifecycle role rather than a logo wall. |
| 05 — Evidence-gated method | Why is the score defensible? | L0–L5 maturity ladder, seven-criterion spider, evidence gate and cap logic. |
| 06 — Target-scoped controls | How is IAM assessed accurately? | Nine target levels, eight control domains and 148-control coverage heatmap. |
| 07 — Bayesian risk | How does evidence change risk? | Prior → test evidence → posterior → scenario risk causal chain with explicit limitations. |
| 08 — Decision workspace | What does the user receive? | Dashboard, interdependency map, technical PDF and remediation-ledger preview. |
| 09 — Secure entry | How does a user begin? | Account verification → protected session → unchanged engine access. |

## Design Direction

The page uses **Assurance Graph** as an integrated page system. Deep navy carries institutional interpretation, teal represents evidenced assurance and action, amber is reserved for provisional or unevidenced states, and red is reserved for caps, exceptions and residual-risk warnings. The primary visual language is framed nodes, evidence rails, connectors, matrices, probability bars and trace metadata—not decorative illustrations, generic feature cards or framework logos.

Typography separates meaning: Georgia supports executive interpretation, Calibri/Aptos supports explanatory content, and Courier New carries model state, source references and metadata. Major chapters alternate light analytical canvases with dark technical canvases to create rhythm while preserving one system.

## Content Controls

All numbers and terminology must reflect the engine: **53 practices**, **148 IAM controls**, **14 standards and frameworks**, **three parallel streams**, **nine IAM assessment target levels**, **eight IAM domains**, **32 control groups**, **202 directional control dependencies**, **seven practice criteria**, and one common **L0–L5** maturity ladder. Bayesian outputs must be described as calibrated comparative or what-if decision support, not as absolute forecasts, until organization-specific priors, conditional probabilities, impact distributions and risk appetite are approved.

## Interaction

Navigation uses anchored chapters and a visible chapter-progress rail. Visual explanations may use compact toggles or tabs for progressive disclosure, but each critical message must remain available without interaction. Motion is limited to restrained transforms and opacity, respects reduced-motion preferences, and never delays keyboard actions.

## Acceptance Criteria

The site must remain readable at normal zoom, avoid page-level horizontal overflow at desktop, tablet and 390-pixel mobile widths, preserve visible keyboard focus, keep authentication and error states clear, and retain exact hash identity of the existing engine file.
