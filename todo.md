# IOPAF PDF Report Redesign

- [x] Audit the current process-level and IAM control-domain PDF generators.
- [x] Inventory available practice, dimension, control, evidence, risk, target and remediation metrics.
- [x] Define a sophisticated technical visual architecture for both report types.
- [x] Add a seven-criterion process spider chart and evidence heatmap.
- [x] Add control-domain group radar/heatmap, maturity distribution and Bayesian risk summary.
- [x] Add visual findings, evidence quality, exception and remediation summaries.
- [x] Preserve offline, self-contained, in-browser PDF generation without external dependencies.
- [x] Validate data accuracy, pagination, overflow and PDF rendering on representative scenarios.
- [x] Synchronize all portal copies and rebuild deployment/download bundles.
- [x] Publish the validated reports release and deliver the new website checkpoint.

## Bayesian risk model independent audit

- [x] Recover the authoritative deployed Bayesian implementation and its existing tests.
- [x] Verify maturity-derived priors and evidence-strength semantics.
- [x] Recalculate beta-binomial posterior mean and interval behavior independently.
- [x] Verify all probability distributions normalize and remain bounded.
- [x] Check monotonicity: stronger controls and stronger evidence must not increase risk.
- [x] Check test exceptions: more exceptions must not reduce posterior failure or residual risk.
- [x] Verify control-to-scenario mappings and unrelated-domain isolation for all 148 controls.
- [x] Verify target-specific responses cannot leak across Overall, database, application, infrastructure or other targets.
- [x] Audit likelihood, consequence, residual-risk and appetite-exceedance aggregation for double counting and unsupported precision.
- [x] Compare dashboard, graph, JSON export and PDF figures for identical scenario outputs.
- [x] Document assumptions, limitations and the final correctness conclusion.
- [x] Correct, regression-test, synchronize and publish the audited model because material defects were found.

## One-page website and authenticated portal access

- [x] Audit the current React shell and embedded portal integration.
- [x] Upgrade the project to the full-stack authentication template.
- [x] Preserve the existing self-contained portal as the protected assessment engine.
- [x] Design a concise one-page public IOPAF website using the established Assurance Graph language.
- [x] Verify and document that the secure Manus account flow supports new-user registration as well as returning-user sign-in.
- [x] Implement persistent session handling, logout and protected portal routing.
- [x] Verify unauthenticated users cannot enter the protected portal route.
- [x] Verify an authenticated session can open `/portal`, load the existing engine iframe and perform a visible engine interaction.
- [x] Validate desktop, tablet and mobile layouts plus keyboard focus order and keyboard activation.
- [x] Save and publish the authenticated website release after all remaining checks pass.

## Clarified website-over-engine requirement

- [x] Keep the existing IOPAF engine file and internal interface unchanged.
- [x] Make the one-page IOPAF website the public root page above the engine.
- [x] Route authenticated users from the public website into the existing engine.
- [x] Confirm direct unauthenticated access to the engine remains blocked.

## Comprehensive public website redesign

- [x] Audit the current public page against the full IOPAF engine capability set.
- [x] Define a comprehensive one-page narrative from business problem to defensible decision.
- [x] Present the three assessment streams and the ideation-to-operation journey visually.
- [x] Explain all fourteen standards as traceable inputs rather than decorative logos.
- [x] Visualize evidence-gated L0-L5 maturity and the seven assessment criteria.
- [x] Visualize target-scoped IAM assessment across nine object levels and 148 controls.
- [x] Explain the independently audited Bayesian risk model and its uncertainty limits.
- [x] Showcase the Controls Dashboard, interdependency map, technical PDF reports and remediation ledger.
- [x] Preserve registration, sign-in, protected portal routing and the unchanged assessment engine.
- [x] Add purposeful interaction and progressive disclosure without generic marketing cards.
- [x] Validate content accuracy, keyboard access, responsiveness and zero horizontal overflow.
- [x] Publish the comprehensive consultant-grade website release.

## Guided capability tour

- [x] Define a five-step tour covering journey, evidence, IAM targeting, Bayesian risk and outputs.
- [x] Add a prominent but restrained “Take the tour” entry point.
- [x] Implement a professional guided-tour overlay with progress, next, previous, skip and finish controls.
- [x] Highlight and scroll to the relevant capability chapter at each tour step.
- [x] Preserve keyboard navigation, focus restoration and reduced-motion behavior.
- [x] Validate desktop, tablet and mobile tour layouts with zero overflow.
- [x] Confirm registration, protected portal access and the existing engine remain unchanged.
- [x] Publish the guided-tour release.

## Image-led website aligned with the engine

- [x] Capture authentic engine views for the landing, journey, Controls workspace, Bayesian risk, dashboard, reports and remediation.
- [x] Curate and crop the strongest engine visuals for website storytelling without altering their meaning.
- [x] Store website images outside the project and upload them as permanent web assets.
- [x] Redesign the hero and capability sections around real engine imagery rather than synthetic interface diagrams.
- [x] Use image-led compositions, annotated frames, layered previews and concise executive copy.
- [x] Preserve the guided tour, registration, sign-in, protected portal route and unchanged engine.
- [x] Optimize images and validate loading performance, alternative text and keyboard behavior.
- [x] Validate desktop, tablet and mobile compositions with zero horizontal overflow.
- [x] Confirm the public site now visually matches the engine’s depth and sophistication.
- [x] Publish the image-led website redesign.

## Balanced three-stream engine visuals

- [x] Capture the authentic Standards page showing how sources map to SDLC, testing, operations and IAM.
- [x] Capture the authentic Journey page showing ideation-to-operation stage governance.
- [x] Capture the CMMI-DEV/TMMi assessment interface and representative SDLC process detail.
- [x] Capture the ITIL Version 5/CMMI-SVC assessment interface and representative operations-practice detail.
- [x] Capture process-level spider, heatmap, gaps/roadmap and report views from Results.
- [x] Curate, optimize and upload the non-Control engine visuals as permanent website assets.
- [x] Rebalance the hero and capability narrative so Development, IT Operations and IAM Controls have equal visual weight.
- [x] Preserve all authentic Controls/Bayesian visuals, guided tour, authentication and protected engine access.
- [x] Validate visual accuracy, image loading, keyboard interaction and zero overflow at desktop, tablet and mobile widths.
- [x] Publish the balanced three-stream visual release.

## Reduced-scroll visual experience

- [x] Measure current desktop, tablet and mobile page height as a baseline.
- [x] Consolidate the Journey and Standards chapters into one compact visual workbench.
- [x] Keep Development, IT Operations and IAM visuals in one tabbed capability workbench.
- [x] Consolidate maturity, process heatmap, Bayesian risk, dashboard, roadmap, reports and remediation into compact analytical tabs.
- [x] Shorten default screenshot windows while retaining full-screen inspection.
- [x] Preserve the five-step guided tour, registration, protected access and unchanged engine.
- [x] Reduce desktop and mobile scroll height materially without removing capability coverage.
- [x] Validate tab keyboard operation, image loading, focus restoration and zero horizontal overflow.
- [x] Publish the compact website release.

## Light executive assurance theme

- [x] Define warm ivory, white, deep ink, cobalt, teal, amber and red semantic tokens.
- [x] Replace the public website’s dark navy-heavy backgrounds with a light executive composition.
- [x] Retheme the header, hero, compact workbenches, tabs, access section, dialogs and footer.
- [x] Preserve readable authentic engine images and clear visual separation from the protected engine.
- [x] Keep teal for evidence/action, amber for provisional/draft and red for risk/exception semantics.
- [x] Validate WCAG-oriented text contrast, keyboard focus visibility and all interaction states.
- [x] Confirm responsive layout, reduced scroll, authentication and the unchanged engine remain intact.
- [x] Publish the light executive theme release.

## Premium theme polish

- [x] Audit the current light palette for cold-blue competition and flat section transitions.
- [x] Replace bright cobalt with a quieter mineral blue used only for structure.
- [x] Strengthen the teal evidence-rule motif across navigation, section numbers, tabs and metadata.
- [x] Introduce warmer ivory, parchment, mist and white tonal transitions between sections.
- [x] Refine shadows, borders and active states for a more editorial consultant-grade finish.
- [x] Preserve amber for provisional meaning and red for risk, caps and exceptions only.
- [x] Validate text contrast, focus rings, mobile rendering, reduced scroll and all interactions.
- [x] Confirm authentication, protected portal access and the unchanged engine remain intact.
- [x] Publish the polished theme release.

## Portal-aligned theme and visible account window

- [x] Extract the portal’s authoritative navy, blue, teal and neutral color relationships from authentic engine views.
- [x] Rebalance the website so navy/blue owns structure and teal is a secondary assurance/action accent.
- [x] Add a prominent Register / Sign in trigger in the sticky header and hero.
- [x] Add an accessible on-site account window with distinct Register and Sign in choices.
- [x] Route both choices through the secure credential provider and back to the protected portal.
- [x] Preserve the authenticated-session state, sign-out control and direct portal protection.
- [x] Validate account-window focus trapping, Escape close and focus restoration.
- [x] Validate desktop, tablet and mobile theme consistency, contrast and zero overflow.
- [x] Confirm the existing engine remains unchanged and usable after authentication.
- [x] Publish the portal-aligned authenticated website release.

## Register and Sign in correction

- [x] Reproduce Register and Sign in on both preview and permanent live domains.
- [x] Verify the on-site account window preserves the selected Register or Sign in mode.
- [x] Verify OAuth type, app ID, callback URL, state nonce and redirect intent for both flows.
- [x] Inspect callback handling, session-cookie creation and authenticated-user persistence.
- [x] Correct registration, sign-in, return routing and visible error recovery.
- [x] Verify unauthenticated `/portal` access redirects safely to the account window.
- [x] Verify successful authentication returns directly to `/portal` and loads the existing engine.
- [x] Verify logout clears the session and re-protects the portal.
- [x] Validate both flows on desktop and mobile with keyboard operation.
- [x] Publish the authentication correction.

## Complete downloadable source package

- [x] Define the full package manifest for website, server, authentication, database, engine, tests and documentation.
- [x] Exclude secrets, environment files, node_modules, logs, caches and temporary build artifacts.
- [x] Add package-specific setup, configuration, database and deployment instructions.
- [x] Include the current protected self-contained IOPAF engine and authenticated website source.
- [x] Include database schema, reviewed migrations, automated tests and project documentation.
- [x] Build the complete ZIP with a stable top-level folder.
- [x] Verify ZIP integrity, expected contents, file sizes and absence of secrets.
- [x] Deliver the complete ZIP package to the user.
