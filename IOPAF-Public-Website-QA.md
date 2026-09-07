# IOPAF Public Website QA

## Release scope

The public root was redesigned as a comprehensive visual introduction to the existing IOPAF engine. The engine remains a separate, authenticated asset and its source file is unchanged.

## Content verification

The page presents the full operating model: three assessment streams; a nine-stage ideation-to-operation journey; 53 practices; 148 IAM controls; fourteen source standards and frameworks; seven practice criteria; nine IAM target levels; eight IAM domains; 32 control groups; 202 directional control dependencies; evidence-gated L0–L5 maturity; the independently audited Bayesian risk method; dashboards; interdependency analysis; technical PDF reports; and structured remediation actions.

## Visual verification

Full-page screenshots were reviewed at **1440 × 1000**, **768 × 1024** and **390 × 844**. The Assurance Graph system remains consistent across the hero, journey, standards matrix, evidence model, target-scoped control heatmap, Bayesian network and decision-output console. The independent visual review concluded that the design is deliberate, technical, editorial and brand-consistent, and recommended shipping it without further style changes.

## Functional verification

The browser regression confirms zero horizontal overflow at desktop, tablet and mobile widths. It verifies all fourteen standards rows, eight domain rows, nine object levels, the Bayesian exact-interval statement, keyboard focus order, keyboard activation of the stream workbench, secure account launch, unauthenticated engine redirection, authenticated engine loading, and a visible Controls navigation interaction inside the unchanged engine.

## Engineering verification

TypeScript checking, Vitest, the production build and the Playwright regression pass. SHA-256 comparison confirms `client/public/app.html` remains byte-identical to the authoritative audited IOPAF engine file.

## Guided capability tour

The five-step guided tour was visually inspected with the first lifecycle step open over its highlighted chapter. The technical briefing panel preserves the Assurance Graph language, keeps the underlying chapter visible as context, and presents clear step progress, assurance signal, next, previous, skip and close controls without obscuring the engine-access path.

Automated browser validation confirms keyboard step navigation with Left/Right Arrow, Escape close, focus trapping and launch-button focus restoration. Tour-panel overflow is **0 pixels at 768 × 1024 tablet width and 390 × 844 mobile width**, while the underlying public page also retains zero overflow at desktop, tablet and mobile widths. The tour covers the lifecycle, evidence-gated maturity, target-scoped IAM, audited Bayesian risk and decision outputs; all critical page content remains available without opening the tour.

## Authentic engine-image redesign

The public website now uses eight authentic IOPAF engine views rather than synthetic interface mock-ups. The hero layers a focused database-target Controls assessment with the live Bayesian risk interpretation; later chapters use the real 148-control dashboard, Bayesian causal network, control-interdependency map, Reports centre and multi-action remediation ledger.

All uploaded engine images decode successfully in the browser and carry specific alternative text. Every image has a keyboard-operable **View full engine screen** control. The full-screen viewer was checked at normal desktop scale: it preserves the original engine detail, closes with Escape, traps focus within the dialog and restores focus to the initiating image control.

The independent visual review found the redesigned page strongly aligned with the Assurance Graph direction and specifically recognized the product screenshots, navy/teal discipline, technical-editorial tone and evidence-ledger language. Desktop and mobile full-page captures show that the real engine screens now dominate the capability narrative while secure access remains distinct and unobstructed.

## Three-stream visual balance correction

Following review, the authentic product imagery was rebalanced so Controls is no longer the dominant visual source. The hero now leads with the real **Journey** and **Standards architecture** screens. The Development stream presents CMMI-DEV Requirements Development and TMMi Test Policy & Strategy; the IT Operations stream presents ITIL Version 5 Incident Management with CMMI-SVC context; IAM retains its target-scoped focused assessment.

The page now also uses the authentic Standards-to-lifecycle mapping, nine-stage Development / Operations / IAM swimlane, seven-dimension process heatmap and process Gaps & Roadmap. Desktop and mobile visual checks confirm that these non-Control screens are prominent, readable through the full-screen viewer and remain contained with zero page-level horizontal overflow.

Automated interaction checks verify all fourteen default authentic engine images load, the Development stream exposes both CMMI-DEV and TMMi screens, the Operations tab switches to the ITIL Version 5/CMMI-SVC screen, and the IAM tab switches to the target-scoped Controls screen without changing secure access or the engine file.

## Reduced-scroll release

The seven long capability chapters were consolidated into four compact workbenches: Journey/Standards, three assessment streams, analytical views and decision outputs. The authentic engine screens remain available through tabs and the full-screen inspector, while only the selected view occupies page height.

| Viewport | Previous height | Compact height | Reduction |
|---|---:|---:|---:|
| Desktop, 1440 × 1000 | 13,698 px | 6,213 px | 54.6% |
| Tablet, 768 × 1024 | 13,587 px | 7,181 px | 47.1% |
| Mobile, 390 × 844 | 15,480 px | 8,844 px | 42.9% |

Desktop and mobile full-page reviews confirm that the shorter page preserves the authentic Journey, Standards, Development, testing, Operations, IAM, maturity, control, Bayesian and output stories without horizontal overflow. The compact tabs support keyboard activation; TMMi, Controls, Bayesian risk and technical reports were explicitly switched through keyboard tests. Registration, protected `/portal` access, authenticated engine loading and the existing engine interaction remain intact.

## Light executive assurance theme

The public website now uses warm ivory and white surfaces, deep ink typography, cobalt structural navigation and tabs, and teal evidence/action signals. Amber remains restricted to provisional or unevidenced meaning, while red remains restricted to caps, risk and exceptions. Authentic engine screens retain their original colors so they remain recognizable evidence artifacts rather than being visually altered.

Full-page desktop and 390-pixel mobile reviews confirm readable headings, supporting copy, tab labels, buttons and account panels. The white sticky header remains legible over every section. Browser validation reports zero horizontal overflow at desktop, tablet and mobile widths; guided-tour focus management, workbench keyboard activation, authenticated engine loading and the unchanged Controls interaction continue to pass.

## Premium editorial color polish

The refined palette replaces bright cobalt competition with a quieter mineral blue and strengthens teal as the consistent evidence/action signature. Warm parchment, near-white, cool mist and pale slate now alternate across chapters; a short teal evidence rule and ledger edge connect section numbers, introductions, tabs and key metadata. Borders use warmer grey-green values and shadows are softer and less dashboard-like.

Desktop and mobile full-page reviews confirm the new transitions remain cohesive without weakening authentic engine screenshots. Amber and red remain semantic rather than decorative. Browser validation continues to report zero horizontal overflow at desktop, tablet and mobile widths, and all guided-tour, tab keyboard, authentication, protected-engine and engine-interaction checks pass.

## Portal-aligned blue theme and account gateway

The public website now uses the same authoritative palette as the assessment engine: navy ink `#0B2E52`, primary blue `#004C97`, paper `#F0F2F5`, white panels, slate `#5D6B7E` and line `#D9E2EC`. Blue now owns navigation, active tabs, primary actions and evidence rules; the former green-dominant treatment has been removed.

A visible Register / Sign in button now appears in the sticky header, with separate Register and Sign in actions in the hero and access section. These open an on-site two-column account window with distinct modes, secure-handoff explanation and direct return intent to `/portal`. The protected identity service still handles credentials.

Automated validation confirms the exact palette tokens, account-window visibility, Register/Sign in switching, keyboard focus trap, Escape close, focus restoration, mobile zero overflow, secure OAuth parameters, authenticated return to `/portal`, protected engine loading and a real Controls navigation interaction. Desktop visual inspection confirms the account window matches the engine’s navy/blue framing.

## Register and Sign in correction

Production reproduction confirmed that the provider exposes one app-specific sign-in-or-sign-up entry screen; the former Register mode incorrectly implied a separate provider registration route. The correction keeps distinct website intent tabs but makes the provider behavior explicit and uses the single supported secure account screen for both first-time and returning users.

The OAuth state now carries an allowlisted `/portal` return path together with the callback origin and one-time nonce. The server callback redirects successful sessions directly to `/portal`, rejects external return values, and converts failed or incomplete callbacks into a visible website retry state. Local cookie policy was also corrected so logout reliably clears non-HTTPS test sessions while production retains secure cross-site attributes.

Browser validation confirms the Register and Sign in website modes, provider URL, app ID, callback URL, unified `type=signIn`, nonce-bound state, `/portal` return, callback failure recovery, desktop/mobile account-window containment, authenticated engine loading, Controls interaction, sign-out, and subsequent portal re-protection. Five Vitest assertions cover protected asset delivery, logout cookie clearing and return-path allowlisting; the TypeScript and production builds pass.
