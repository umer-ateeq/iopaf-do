import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef, useState } from "react";

const standards = [
  ["01", "CMMI-DEV", "Build", "Development capability"],
  ["02", "TMMi", "Validate", "Test-process maturity"],
  ["03", "ISO/IEC/IEEE 29119", "Validate", "Software testing"],
  ["04", "ITIL Version 5", "Operate", "Product and service management"],
  ["05", "CMMI-SVC", "Operate", "Service delivery capability"],
  ["06", "COBIT", "Govern", "Enterprise governance"],
  ["07", "ISO/IEC 20000-1", "Operate", "Service-management system"],
  ["08", "ISO/IEC 27001", "Control", "Information-security management"],
  ["09", "NIST CSF", "Control", "Cybersecurity outcomes"],
  ["10", "NIST SP 800-53", "Control", "Security and privacy controls"],
  ["11", "CIS Controls", "Control", "Prioritized safeguards"],
  ["12", "OWASP", "Control", "Application security"],
  ["13", "CSA CCM", "Control", "Cloud control framework"],
  ["14", "MITRE ATT&CK", "Control", "Adversary behavior knowledge"],
];

const streams = [
  {
    key: "development",
    label: "Development",
    number: "01",
    title: "Engineer capability from idea to release",
    body: "Assess requirements, planning, engineering, integration and release readiness against CMMI-DEV—while TMMi and ISO/IEC/IEEE 29119 provide a dedicated test-assurance layer.",
    coverage: "12 CMMI-DEV practices · 7 TMMi processes",
    sources: "CMMI-DEV · TMMi · ISO/IEC/IEEE 29119",
    output: "Seven-criterion maturity profile and process-level technical report",
    visual: "/engine/sdlc-cmmi-dev-assessment.webp",
    visualLabel: "SDLC ASSESSMENT",
    visualTitle: "CMMI-DEV Requirements Development",
    visualAlt: "Authentic IOPAF CMMI-DEV Requirements Development assessment showing standards context, maturity spider, evidence cap, correction action and scored questions",
    companion: "/engine/tmmi-testing-assessment.webp",
    companionLabel: "TEST ASSURANCE",
    companionTitle: "TMMi Test Policy & Strategy",
    companionAlt: "Authentic IOPAF TMMi Test Policy and Strategy assessment showing ISO 29119 context, process spider, evidence gate and testing questions",
  },
  {
    key: "operations",
    label: "IT operations",
    number: "02",
    title: "Examine how technology is governed and operated",
    body: "Evaluate operating practices, service governance, value delivery, performance and continual improvement using ITIL Version 5, CMMI-SVC, COBIT and ISO/IEC 20000-1.",
    coverage: "34 ITIL Version 5 management practices",
    sources: "ITIL Version 5 · CMMI-SVC · COBIT · ISO/IEC 20000-1",
    output: "Practice profiles, cross-practice heatmaps and improvement roadmaps",
    visual: "/engine/it-operations-assessment.webp",
    visualLabel: "IT OPERATIONS ASSESSMENT",
    visualTitle: "ITIL Version 5 Incident Management",
    visualAlt: "Authentic IOPAF Incident Management assessment showing ITIL Version 5 and CMMI-SVC source context, seven-dimension maturity, evidence cap and improvement action",
    companion: null,
    companionLabel: null,
    companionTitle: null,
    companionAlt: null,
  },
  {
    key: "iam",
    label: "IAM controls",
    number: "03",
    title: "Test control effectiveness at the right target",
    body: "Assess identity and access controls at enterprise, shared-service, infrastructure, network, database, platform, cloud, application and API levels—not as one misleading overall answer.",
    coverage: "148 controls · 8 domains · 32 groups · 9 target levels",
    sources: "ISO/IEC 27001 · NIST · CIS · OWASP · CSA · MITRE",
    output: "Target-scoped control maturity, Bayesian risk and remediation register",
    visual: "/engine/controls-assessment.webp",
    visualLabel: "IAM CONTROL ASSESSMENT",
    visualTitle: "Database-target control assurance",
    visualAlt: "Authentic IOPAF focused IAM Controls assessment showing database target, control queue, evidence, effective maturity and posterior failure",
    companion: null,
    companionLabel: null,
    companionTitle: null,
    companionAlt: null,
  },
];

const journeyStages = [
  ["01", "Ideate", "Intent"],
  ["02", "Discover", "Need"],
  ["03", "Design", "Architecture"],
  ["04", "Build", "Engineering"],
  ["05", "Test", "Verification"],
  ["06", "Release", "Transition"],
  ["07", "Operate", "Service"],
  ["08", "Improve", "Performance"],
  ["09", "Govern", "Assurance"],
];

const objectLevels = [
  "Enterprise / Overall",
  "Shared IAM",
  "Infrastructure",
  "Network",
  "Database",
  "Platform",
  "Cloud",
  "Application",
  "API",
];

const controlDomains = [
  "Governance & strategy",
  "Identity lifecycle",
  "Authentication",
  "Authorization",
  "Privileged access",
  "Access assurance",
  "Technical enforcement",
  "Monitoring & response",
];

const engineImages = {
  standards: "/engine/standards-lifecycle-mapping.webp",
  journey: "/engine/journey-three-streams.webp",
  sdlc: "/engine/sdlc-cmmi-dev-assessment.webp",
  tmmi: "/engine/tmmi-testing-assessment.webp",
  operations: "/engine/it-operations-assessment.webp",
  processHeatmap: "/engine/process-results-heatmap.webp",
  processRoadmap: "/engine/process-results-roadmap.webp",
  controls: "/engine/controls-assessment.webp",
  remediation: "/engine/remediation-ledger.webp",
  riskSummary: "/engine/bayesian-summary.webp",
  riskNetwork: "/engine/bayesian-network.webp",
  dashboard: "/engine/controls-dashboard.webp",
  dependencies: "/engine/control-interdependencies.webp",
  reports: "/engine/reports-centre.webp",
};

const foundationViews = [
  {
    key: "journey",
    label: "Journey",
    title: "Nine stages · three assurance lanes",
    body: "See how Development, testing, IT Operations and IAM evidence travel from ideation to live service.",
    image: engineImages.journey,
    alt: "Authentic IOPAF Journey page showing maturity health, nine delivery stages and Development, IT Operations and IAM swimlanes",
  },
  {
    key: "standards",
    label: "Standards map",
    title: "Fourteen sources · one governed engine",
    body: "See exactly where CMMI-DEV, TMMi, ITIL Version 5, CMMI-SVC and IAM sources apply on the lifecycle.",
    image: engineImages.standards,
    alt: "Authentic IOPAF Standards page mapping CMMI-DEV, TMMi, ITIL Version 5, CMMI-SVC, overlays and the IAM control library to the journey",
  },
];

const analysisViews = [
  { key: "maturity", label: "Maturity method", title: "Claim → evidence gate → effective level", body: "Seven criteria form each process profile. Weak evidence constrains unsupported L4/L5 claims before a result reaches reporting.", signal: "L0–L5 · seven criteria · evidence cap", image: engineImages.sdlc, alt: "Authentic CMMI-DEV assessment showing the seven-dimension spider and evidence-gated effective maturity" },
  { key: "process", label: "Process heatmap", title: "Seven dimensions across SDLC and operations", body: "The heatmap exposes weak dimensions across practices while every cell remains traceable to its question and source criterion.", signal: "53 practices · cross-practice comparison", image: engineImages.processHeatmap, alt: "Authentic IOPAF Results heatmap showing seven maturity dimensions across assessed practices" },
  { key: "controls", label: "Controls estate", title: "148 controls · nine target levels", body: "Control maturity remains separate for enterprise, shared IAM, infrastructure, network, database, platform, cloud, application and API targets.", signal: "148 controls · 8 domains · 202 dependencies", image: engineImages.dashboard, alt: "Authentic IOPAF 148-control dashboard showing classifications, evidence states, maturity and target context" },
  { key: "risk", label: "Bayesian risk", title: "Test evidence → posterior → residual risk", body: "Exact Beta intervals update control-failure uncertainty and propagate through formal causal roles without presenting an uncalibrated score as an absolute forecast.", signal: "8 scenarios · exact intervals · visible assumptions", image: engineImages.riskNetwork, alt: "Authentic IOPAF Bayesian causal network showing control-group posteriors, likelihood, consequence and residual risk" },
];

const outputViews = [
  { key: "roadmap", label: "Gaps & roadmap", title: "Weakness → owner → target date → status", body: "Question-level weaknesses become a governed portfolio rather than disappearing into an assessment score.", image: engineImages.processRoadmap, alt: "Authentic IOPAF Gaps and Roadmap view showing process weaknesses, owners, dates and action status" },
  { key: "dependencies", label: "Dependencies", title: "Upstream enablers and downstream reliance", body: "Trace immediate and two-hop relationships to understand which controls enable—or depend on—each measure.", image: engineImages.dependencies, alt: "Authentic IOPAF control interdependency view tracing upstream prerequisites and downstream dependent controls" },
  { key: "reports", label: "Technical reports", title: "Whole assessment · practice · control domain", body: "Generate visual PDFs and data exports at portfolio, process, object and control-domain level directly in the browser.", image: engineImages.reports, alt: "Authentic IOPAF Reports centre showing visual reports and per-practice and per-domain downloads" },
  { key: "remediation", label: "Remediation", title: "Multiple actions per control and target", body: "Assign owners, due dates, priorities, statuses and closure evidence without overwriting actions recorded for another target.", image: engineImages.remediation, alt: "Authentic IOPAF multi-action remediation ledger with owner, due date, priority, status and closure evidence" },
];

type EngineVisual = { src: string; alt: string; label: string; title: string };
type OpenEngineVisual = (visual: EngineVisual, trigger: HTMLButtonElement) => void;

const tourSteps = [
  {
    chapter: "journey",
    label: "ONE LIFECYCLE",
    title: "Follow assurance from ideation to operation",
    body: "IOPAF closes the hand-off gap between delivery and operations. Development, test, service and IAM assurance remain visible as connected lanes across nine lifecycle stages.",
    signal: "Decision question: Where does capability need to hold?",
  },
  {
    chapter: "model",
    label: "EVIDENCE-GATED MATURITY",
    title: "Separate the claimed level from the defensible level",
    body: "Seven criteria shape each practice profile. Evidence strength, sample coverage and exceptions determine whether a selected L0–L5 level can survive the evidence gate.",
    signal: "Decision rule: No evidence, no unsupported maturity claim.",
  },
  {
    chapter: "model",
    label: "TARGET-SCOPED IAM",
    title: "Test each control where it actually operates",
    body: "The same control can have a different result for a database, application or shared identity service. IOPAF keeps all nine target levels isolated while retaining one 148-control estate view.",
    signal: "Decision context: Control ID + assessment target.",
  },
  {
    chapter: "model",
    label: "AUDITED BAYESIAN RISK",
    title: "Use test evidence to update uncertainty",
    body: "Sample exceptions update exact Beta control-failure intervals, then formal control effects propagate through eight scenarios. The model exposes assumptions and tail probability instead of hiding them behind a colour.",
    signal: "Decision limit: Comparative until organization-calibrated.",
  },
  {
    chapter: "outputs",
    label: "DECISION WORKSPACE",
    title: "Convert assessment evidence into accountable action",
    body: "A 148-control dashboard, dependency tracing, technical visual PDFs and a target-specific remediation ledger connect diagnosis to owners, due dates, closure evidence and management decisions.",
    signal: "Decision output: Evidence → finding → owner → closure proof.",
  },
];

function EngineFrame({
  src,
  alt,
  label,
  title,
  className = "",
  eager = false,
  onOpen,
}: {
  src: string;
  alt: string;
  label: string;
  title: string;
  className?: string;
  eager?: boolean;
  onOpen: OpenEngineVisual;
}) {
  return (
    <figure className={`engine-frame ${className}`.trim()}>
      <div className="engine-frame-head"><span>{label}</span><b>{title}</b><i>AUTHENTIC ENGINE VIEW</i></div>
      <button className="engine-frame-open" onClick={(event) => onOpen({ src, alt, label, title }, event.currentTarget)} aria-label={`Open full engine view: ${title}`}>
        <span className="engine-frame-screen"><img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" /></span>
        <span className="engine-frame-action">VIEW FULL ENGINE SCREEN <i aria-hidden="true">↗</i></span>
      </button>
    </figure>
  );
}

function EngineHeroVisual({ onOpen }: { onOpen: OpenEngineVisual }) {
  return (
    <div className="engine-hero-visual">
      <EngineFrame
        src={engineImages.journey}
        alt="Authentic IOPAF Journey page showing nine stages from ideation to operation with Development, IT Operations and IAM assurance lanes"
        label="ONE ASSESSMENT JOURNEY"
        title="Development · operations · IAM across nine stages"
        className="hero-engine-frame"
        eager
        onOpen={onOpen}
      />
      <EngineFrame
        src={engineImages.standards}
        alt="Authentic IOPAF Standards page showing CMMI-DEV, TMMi, ITIL Version 5, CMMI-SVC and IAM source frameworks mapped to the lifecycle"
        label="STANDARDS ARCHITECTURE"
        title="Fourteen sources · three governed streams"
        className="hero-risk-frame"
        eager
        onOpen={onOpen}
      />
      <div className="hero-visual-caption"><span>WORKING PRODUCT</span><b>What you see is the assessment engine—not a conceptual mock-up.</b></div>
    </div>
  );
}

function SevenCriteriaSpider() {
  return (
    <div className="spider-wrap">
      <svg className="criteria-spider" viewBox="0 0 420 330" role="img" aria-labelledby="spider-title spider-desc">
        <title id="spider-title">Seven-criterion practice profile</title>
        <desc id="spider-desc">Illustrative maturity profile across purpose, governance, process, people, technology, performance and improvement.</desc>
        <g transform="translate(210 164)">
          {[1, 2, 3, 4, 5].map((level) => (
            <polygon key={level} points={`${0},${-25 * level} ${19.55 * level},${-15.58 * level} ${24.38 * level},${5.56 * level} ${10.85 * level},${22.52 * level} ${-10.85 * level},${22.52 * level} ${-24.38 * level},${5.56 * level} ${-19.55 * level},${-15.58 * level}`} className="spider-grid" />
          ))}
          {[[0,-125],[97.75,-77.9],[121.9,27.8],[54.25,112.6],[-54.25,112.6],[-121.9,27.8],[-97.75,-77.9]].map(([x,y], index) => <line key={index} x1="0" y1="0" x2={x} y2={y} className="spider-axis" />)}
          <polygon points="0,-95 72,-58 102,23 39,81 -43,89 -84,19 -55,-44" className="spider-value" />
          <circle cx="0" cy="-95" r="4" /><circle cx="72" cy="-58" r="4" /><circle cx="102" cy="23" r="4" /><circle cx="39" cy="81" r="4" /><circle cx="-43" cy="89" r="4" /><circle cx="-84" cy="19" r="4" /><circle cx="-55" cy="-44" r="4" />
        </g>
        <g className="spider-labels"><text x="210" y="20" textAnchor="middle">PURPOSE</text><text x="355" y="91">GOVERNANCE</text><text x="370" y="205">PROCESS</text><text x="290" y="312">PEOPLE</text><text x="80" y="312">TECHNOLOGY</text><text x="8" y="205">PERFORMANCE</text><text x="12" y="89">IMPROVEMENT</text></g>
      </svg>
      <small>Illustrative method profile · actual assessments use the user’s evidence</small>
    </div>
  );
}

function BayesianNetwork({ onOpen }: { onOpen: OpenEngineVisual }) {
  return (
    <div className="risk-image-composition">
      <EngineFrame
        src={engineImages.riskSummary}
        alt="IOPAF Bayesian risk summary for an account-compromise scenario, showing prior and residual likelihood, consequence, residual-risk distribution, sensitivity and model confidence"
        label="EXECUTIVE INTERPRETATION"
        title="Likelihood · consequence · residual-risk tail"
        className="risk-summary-frame"
        onOpen={onOpen}
      />
      <EngineFrame
        src={engineImages.riskNetwork}
        alt="IOPAF expandable Bayesian causal network showing scenario context, control-group posteriors, preventive barriers, likelihood, consequence and residual risk"
        label="CAUSAL MODEL"
        title="From tested controls to scenario posterior"
        className="risk-network-frame"
        onOpen={onOpen}
      />
    </div>
  );
}

function CapabilityOutputs({ onOpen }: { onOpen: OpenEngineVisual }) {
  return (
    <div className="output-image-gallery">
      <EngineFrame
        src={engineImages.processRoadmap}
        alt="Authentic IOPAF Gaps and Roadmap Results view showing process weaknesses, source references, owners, target dates and action status"
        label="PROCESS IMPROVEMENT"
        title="Question-level gaps become an owned roadmap"
        className="roadmap-frame"
        onOpen={onOpen}
      />
      <EngineFrame
        src={engineImages.dependencies}
        alt="IOPAF control interdependency view tracing upstream prerequisites, a selected MFA control and downstream dependent controls"
        label="CONTROL INTERDEPENDENCIES"
        title="Trace what enables—and depends on—each measure"
        className="dependency-frame"
        onOpen={onOpen}
      />
      <EngineFrame
        src={engineImages.reports}
        alt="IOPAF Reports centre showing technical visual reports, whole-assessment exports, Bayesian model exports and per-practice downloads"
        label="TECHNICAL REPORTING"
        title="Whole assessment · practice · control domain"
        className="reports-frame"
        onOpen={onOpen}
      />
      <EngineFrame
        src={engineImages.remediation}
        alt="IOPAF multi-action remediation ledger showing descriptions, owners, dates, priorities, status and completion evidence"
        label="ACCOUNTABLE REMEDIATION"
        title="Multiple actions per control and target"
        className="remediation-frame"
        onOpen={onOpen}
      />
    </div>
  );
}

export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const [activeFoundation, setActiveFoundation] = useState(0);
  const [activeStream, setActiveStream] = useState(0);
  const [activeStreamVisual, setActiveStreamVisual] = useState(0);
  const [activeAnalysis, setActiveAnalysis] = useState(0);
  const [activeOutput, setActiveOutput] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [activeVisual, setActiveVisual] = useState<EngineVisual | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "signin">("register");
  const tourLaunchRef = useRef<HTMLButtonElement>(null);
  const tourPanelRef = useRef<HTMLDivElement>(null);
  const tourWasOpenedRef = useRef(false);
  const visualDialogRef = useRef<HTMLDivElement>(null);
  const visualTriggerRef = useRef<HTMLButtonElement | null>(null);
  const authDialogRef = useRef<HTMLDivElement>(null);
  const authTriggerRef = useRef<HTMLButtonElement | null>(null);
  const authStatus = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("auth") : null;
  const authRequired = authStatus === "required";
  const authFailed = authStatus === "failed";
  const displayName = user?.name || user?.email || "IOPAF user";
  const foundation = foundationViews[activeFoundation];
  const stream = streams[activeStream];
  const streamVisuals = [
    { src: stream.visual, alt: stream.visualAlt, label: stream.visualLabel, title: stream.visualTitle },
    ...(stream.companion && stream.companionAlt && stream.companionLabel && stream.companionTitle ? [{ src: stream.companion, alt: stream.companionAlt, label: stream.companionLabel, title: stream.companionTitle }] : []),
  ];
  const selectedStreamVisual = streamVisuals[Math.min(activeStreamVisual, streamVisuals.length - 1)];
  const analysis = analysisViews[activeAnalysis];
  const output = outputViews[activeOutput];
  const openPortal = () => { window.location.href = "/portal"; };
  const signOut = async () => { await logout(); window.location.href = "/"; };
  const openAuth = (mode: "register" | "signin", trigger?: HTMLButtonElement | null) => {
    authTriggerRef.current = trigger || null;
    setAuthMode(mode);
    setAuthOpen(true);
  };
  const closeAuth = () => {
    setAuthOpen(false);
    window.setTimeout(() => authTriggerRef.current?.focus(), 0);
  };
  const continueToSecureAccount = () => {
    // Was startLogin("/portal"), which redirected to the Manus OAuth portal.
    // Identity now comes from Supabase via the /login page.
    window.location.href = "/login";
  };
  const currentTour = tourSteps[tourStep];
  const openTour = () => { tourWasOpenedRef.current = true; setTourStep(0); setTourOpen(true); };
  const closeTour = () => { setTourOpen(false); };
  const openVisual: OpenEngineVisual = (visual, trigger) => {
    visualTriggerRef.current = trigger;
    setActiveVisual(visual);
  };
  const closeVisual = () => {
    setActiveVisual(null);
    window.setTimeout(() => visualTriggerRef.current?.focus(), 0);
  };
  const moveTour = (direction: number) => {
    const next = Math.min(tourSteps.length - 1, Math.max(0, tourStep + direction));
    setTourStep(next);
  };
  const tourTargetClass = (id: string) => tourOpen && currentTour.chapter === id ? " tour-target-active" : "";

  useEffect(() => {
    if (!tourOpen) return;
    if (currentTour.label === "ONE LIFECYCLE") setActiveFoundation(0);
    if (currentTour.label === "EVIDENCE-GATED MATURITY") setActiveAnalysis(0);
    if (currentTour.label === "TARGET-SCOPED IAM") setActiveAnalysis(2);
    if (currentTour.label === "AUDITED BAYESIAN RISK") setActiveAnalysis(3);
    if (currentTour.label === "DECISION WORKSPACE") setActiveOutput(0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(currentTour.chapter)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    const focusTimer = window.setTimeout(() => tourPanelRef.current?.focus(), reduceMotion ? 0 : 240);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeTour(); }
      if (event.key === "ArrowRight") { event.preventDefault(); moveTour(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); moveTour(-1); }
      if (event.key !== "Tab" || !tourPanelRef.current) return;
      const controls = Array.from(tourPanelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tourOpen, tourStep, currentTour.chapter]);

  useEffect(() => {
    if (tourOpen || !tourWasOpenedRef.current) return;
    const restoreTimer = window.setTimeout(() => {
      tourLaunchRef.current?.focus();
      tourWasOpenedRef.current = false;
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [tourOpen]);

  useEffect(() => {
    if (!activeVisual) return;
    visualDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeVisual(); }
      if (event.key !== "Tab" || !visualDialogRef.current) return;
      const controls = Array.from(visualDialogRef.current.querySelectorAll<HTMLElement>("button"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeVisual]);

  useEffect(() => {
    if ((authRequired || authFailed) && !isAuthenticated && !loading) {
      setAuthMode("signin");
      setAuthOpen(true);
    }
  }, [authRequired, authFailed, isAuthenticated, loading]);

  useEffect(() => {
    if (!authOpen) return;
    authDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeAuth(); }
      if (event.key !== "Tab" || !authDialogRef.current) return;
      const controls = Array.from(authDialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="IOPAF home"><span>IOPAF</span><i aria-hidden="true" /><small>IT Operations Practice Assessment Framework</small></a>
        <nav aria-label="Primary navigation"><a href="#journey">Journey</a><a href="#streams">Capabilities</a><a href="#model">Method</a><a href="#outputs">Outputs</a></nav>
        <div className="header-actions">{isAuthenticated ? <button className="button button-primary button-small" onClick={openPortal}>Open portal</button> : <button className="button button-primary button-small account-launch" onClick={(event) => openAuth("signin", event.currentTarget)}>Register / Sign in</button>}</div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">One evidence model · the complete IT lifecycle</p>
            <h1>Turn IT capability into a decision you can defend.</h1>
            <p className="hero-lede">IOPAF is a connected assessment engine for development, testing, service operations and identity controls. It links every maturity result and risk signal to scope, source criteria, tested evidence and an accountable next action.</p>
            <div className="hero-actions">{isAuthenticated ? <button className="button button-primary" onClick={openPortal}>Enter assessment engine</button> : <><button className="button button-primary" onClick={(event) => openAuth("register", event.currentTarget)}>Register</button><button className="button button-outline" onClick={(event) => openAuth("signin", event.currentTarget)}>Sign in</button></>}<button ref={tourLaunchRef} className="button tour-trigger" onClick={openTour}>Take the guided tour</button><a className="text-link" href="#journey">Explore engine capabilities</a></div>
            <div className="hero-proof" aria-label="IOPAF engine coverage"><div><b>53</b><span>development + operations practices</span></div><div><b>148</b><span>IAM controls</span></div><div><b>14</b><span>source standards</span></div><div><b>202</b><span>control dependencies</span></div></div>
          </div>
          <EngineHeroVisual onOpen={openVisual} />
        </section>

        <section className="trust-ribbon"><span>ENGINE SCOPE</span><b>Ideation</b><i /><b>Build</b><i /><b>Test</b><i /><b>Release</b><i /><b>Operate</b><i /><b>Improve</b><strong>Assurance remains traceable end to end</strong></section>

        <section className={`chapter journey-section compact-chapter${tourTargetClass("journey")}`} id="journey">
          <div className="chapter-head"><span className="chapter-no">01</span><div><p className="eyebrow">Journey and standards</p><h2>See where capability is tested—and which standard governs it.</h2></div><p className="chapter-intro">Two authentic engine views connect the nine-stage lifecycle to fourteen source frameworks. Switch the view; open the full screen only when you need the detail.</p></div>
          <div className="compact-workbench foundation-workbench">
            <div className="compact-tabs" role="tablist" aria-label="Journey and standards views">{foundationViews.map((item,index)=><button key={item.key} role="tab" aria-selected={activeFoundation===index} onClick={()=>setActiveFoundation(index)}><span>0{index+1}</span><b>{item.label}</b></button>)}</div>
            <div className="compact-panel" role="tabpanel"><div className="compact-panel-copy"><p className="panel-meta">{foundation.label.toUpperCase()}</p><h3>{foundation.title}</h3><p>{foundation.body}</p>{activeFoundation===1&&<details id="standards" className="standards-disclosure"><summary>Review all fourteen sources</summary><div className="standards-mini-grid">{standards.map(([no,name,role])=><span key={no}><b>{no}</b><strong>{name}</strong><em>{role}</em></span>)}</div></details>}</div><EngineFrame src={foundation.image} alt={foundation.alt} label="AUTHENTIC ENGINE VIEW" title={foundation.title} className="compact-engine-frame" onOpen={openVisual}/></div>
          </div>
        </section>

        <section className="chapter streams-section" id="streams">
          <div className="chapter-head inverse"><span className="chapter-no">02</span><div><p className="eyebrow">Three parallel streams</p><h2>Different standards. One governed maturity language.</h2></div><p className="chapter-intro">Each stream retains its own criteria and evidence logic. IOPAF makes their outputs comparable on one L0–L5 ladder without flattening the differences between process maturity and control effectiveness.</p></div>
          <div className="stream-workbench compact-stream-workbench">
            <div className="stream-tabs" role="tablist" aria-label="IOPAF assurance streams">{streams.map((item, index) => <button key={item.key} role="tab" aria-selected={activeStream === index} aria-controls="stream-detail" onClick={() => setActiveStream(index)}><span>{item.number}</span><b>{item.label}</b><small>{item.coverage}</small></button>)}</div>
            <div className="stream-detail" id="stream-detail" role="tabpanel"><div className="stream-detail-layout"><div className="stream-detail-copy"><div className="stream-signal"><span>ACTIVE ASSURANCE LANE</span><i /><b>{stream.number}</b></div><h3>{stream.title}</h3><p>{stream.body}</p><dl><div><dt>COVERAGE</dt><dd>{stream.coverage}</dd></div><div><dt>TRACEABLE SOURCES</dt><dd>{stream.sources}</dd></div><div><dt>DECISION OUTPUT</dt><dd>{stream.output}</dd></div></dl></div><div className="stream-engine-views">{streamVisuals.length>1&&<div className="visual-subtabs" role="tablist" aria-label={`${stream.label} engine views`}>{streamVisuals.map((item,index)=><button key={item.title} role="tab" aria-selected={activeStreamVisual===index} onClick={()=>setActiveStreamVisual(index)}>{index===0?"CMMI-DEV":"TMMi"}</button>)}</div>}<EngineFrame src={selectedStreamVisual.src} alt={selectedStreamVisual.alt} label={selectedStreamVisual.label} title={selectedStreamVisual.title} onOpen={openVisual} /></div></div></div>
          </div>
        </section>

        <section className={`chapter model-section compact-chapter${tourTargetClass("model")}`} id="model">
          <span id="controls" className="section-anchor"/><span id="risk" className="section-anchor"/>
          <div className="chapter-head inverse"><span className="chapter-no">03</span><div><p className="eyebrow">Analysis workbench</p><h2>Move from evidence-gated maturity to target-scoped risk.</h2></div><p className="chapter-intro">Four analytical views replace three long chapters. Switch between the maturity method, process heatmap, 148-control estate and audited Bayesian model.</p></div>
          <div className="compact-workbench analysis-workbench"><div className="compact-tabs" role="tablist" aria-label="IOPAF analytical views">{analysisViews.map((item,index)=><button key={item.key} role="tab" aria-selected={activeAnalysis===index} onClick={()=>setActiveAnalysis(index)}><span>0{index+1}</span><b>{item.label}</b></button>)}</div><div className="compact-panel" role="tabpanel"><div className="compact-panel-copy"><p className="panel-meta">{analysis.label.toUpperCase()}</p><h3>{analysis.title}</h3><p>{analysis.body}</p><strong className="compact-signal">{analysis.signal}</strong>{analysis.key==="maturity"&&<div className="mini-method"><b>L4 asserted</b><i/><span>Evidence gate</span><i/><b>L2 effective</b></div>}{analysis.key==="controls"&&<div className="target-mini-grid">{objectLevels.map((level,index)=><span key={level} className={index===4?"active":""}>{level.replace(" / Overall","")}</span>)}</div>}{analysis.key==="risk"&&<small className="model-limit">Comparative / what-if until organization-calibrated.</small>}</div><EngineFrame src={analysis.image} alt={analysis.alt} label="AUTHENTIC ANALYTICAL VIEW" title={analysis.title} className="compact-engine-frame" onOpen={openVisual}/></div></div>
        </section>

        <section className={`chapter outputs-section compact-chapter${tourTargetClass("outputs")}`} id="outputs">
          <div className="chapter-head"><span className="chapter-no">04</span><div><p className="eyebrow">Decision outputs</p><h2>Inspect the output you need—without scrolling past every other one.</h2></div><p className="chapter-intro">Roadmaps, dependencies, technical reports and remediation remain one click away, with every authentic screen available at full readable size.</p></div>
          <div className="compact-workbench output-workbench"><div className="compact-tabs" role="tablist" aria-label="IOPAF decision outputs">{outputViews.map((item,index)=><button key={item.key} role="tab" aria-selected={activeOutput===index} onClick={()=>setActiveOutput(index)}><span>0{index+1}</span><b>{item.label}</b></button>)}</div><div className="compact-panel" role="tabpanel"><div className="compact-panel-copy"><p className="panel-meta">{output.label.toUpperCase()}</p><h3>{output.title}</h3><p>{output.body}</p><strong className="compact-signal">Assessment evidence → governed decision</strong></div><EngineFrame src={output.image} alt={output.alt} label="AUTHENTIC OUTPUT VIEW" title={output.title} className="compact-engine-frame" onOpen={openVisual}/></div></div>
        </section>

        <section className="access-section" id="access">
          <div className="access-copy"><p className="eyebrow">Secure entry · existing engine preserved</p><h2>Explore the framework. Enter the engine when you are ready.</h2><p>The public website explains IOPAF. Registration or sign-in unlocks the existing assessment engine behind a protected session. Your assessment responses remain in the browser unless you explicitly export them.</p><div className="access-trace"><span>Account verified</span><i aria-hidden="true" /><span>Session protected</span><i aria-hidden="true" /><span>Engine unlocked</span></div></div>
          <div className="auth-panel">{loading ? <div className="auth-loading" role="status">Checking secure session…</div> : isAuthenticated ? <><p className="panel-meta">AUTHENTICATED SESSION</p><h3>Welcome, {displayName}</h3><p>{user?.email || "Your account is ready to access IOPAF."}</p><button className="button button-primary button-wide" onClick={openPortal}>Enter assessment engine</button><button className="button button-outline button-wide" onClick={signOut}>Sign out</button></> : <><p className="panel-meta">ACCOUNT ACCESS</p><h3>Sign in or create an account</h3><p>IOPAF uses one secure identity screen for returning users and first-time registration. Choose your intent here, then continue.</p>{authRequired && <div className="auth-notice">Sign in or registration is required before the assessment engine can be opened.</div>}{(authFailed || error) && <div className="auth-error">Account verification did not complete. Please retry and allow cookies for this site.</div>}<button className="button button-primary button-wide" onClick={(event) => openAuth("register", event.currentTarget)}>Open secure account access</button><small>Your password is entered only on the protected identity screen and is never handled by IOPAF.</small></>}</div>
        </section>
      </main>

      {tourOpen && (
        <div className="tour-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTour(); }}>
          <div className="tour-panel" ref={tourPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
            <div className="tour-panel-head">
              <div><span>GUIDED CAPABILITY TOUR</span><b>{String(tourStep + 1).padStart(2, "0")} / {String(tourSteps.length).padStart(2, "0")}</b></div>
              <button className="tour-close" onClick={closeTour} aria-label="Close guided tour">Close</button>
            </div>
              <div className="tour-progress" aria-label={`Tour step ${tourStep + 1} of ${tourSteps.length}`}>{tourSteps.map((step, index) => <button key={step.label} className={index === tourStep ? "active" : index < tourStep ? "complete" : ""} onClick={() => setTourStep(index)} aria-label={`Go to tour step ${index + 1}: ${step.label}`}><i /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div>
            <p className="tour-label">{currentTour.label}</p>
            <h2 id="tour-title">{currentTour.title}</h2>
            <p id="tour-body">{currentTour.body}</p>
            <div className="tour-signal"><span>ASSURANCE SIGNAL</span><b>{currentTour.signal}</b></div>
            <div className="tour-actions">
              <button className="tour-skip" onClick={closeTour}>Skip tour</button>
              <div>
                <button className="button tour-previous" onClick={() => moveTour(-1)} disabled={tourStep === 0}>Previous</button>
                {tourStep < tourSteps.length - 1 ? <button className="button button-primary" onClick={() => moveTour(1)}>Next capability</button> : <button className="button button-primary" onClick={closeTour}>Finish tour</button>}
              </div>
            </div>
            <small className="tour-keyboard">Keyboard: ← previous · → next · Esc close</small>
          </div>
        </div>
      )}

      {activeVisual && (
        <div className="visual-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeVisual(); }}>
          <div className="visual-dialog" ref={visualDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="visual-title">
            <div className="visual-dialog-head"><div><span>{activeVisual.label}</span><h2 id="visual-title">{activeVisual.title}</h2></div><button onClick={closeVisual} aria-label="Close full engine view">Close</button></div>
            <div className="visual-dialog-image"><img src={activeVisual.src} alt={activeVisual.alt} /></div>
            <div className="visual-dialog-foot"><span>AUTHENTIC IOPAF ENGINE SCREEN</span><b>Example assessment data · interface shown at readable scale</b></div>
          </div>
        </div>
      )}

      {authOpen && !isAuthenticated && (
        <div className="account-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAuth(); }}>
          <div className="account-window" ref={authDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="account-title" aria-describedby="account-description">
            <div className="account-window-intro">
              <div className="account-brand"><span>IOPAF</span><i aria-hidden="true" /><small>SECURE ENGINE ACCESS</small></div>
              <p>Protected assessment workspace</p>
              <h2 id="account-title">Enter with an accountable identity.</h2>
              <div className="account-trace"><span>Account</span><i/><span>Protected session</span><i/><span>Assessment engine</span></div>
              <small>IOPAF never receives or stores the password entered on the protected identity screen.</small>
            </div>
            <div className="account-window-action">
              <button className="account-close" onClick={closeAuth} aria-label="Close Register and Sign in window">Close</button>
              <div className="account-tabs" role="tablist" aria-label="Choose account action">
                <button role="tab" aria-selected={authMode === "register"} onClick={() => setAuthMode("register")}>Register</button>
                <button role="tab" aria-selected={authMode === "signin"} onClick={() => setAuthMode("signin")}>Sign in</button>
              </div>
              <p className="panel-meta">{authMode === "register" ? "NEW ACCOUNT" : "RETURNING USER"}</p>
              <h3>{authMode === "register" ? "Create your IOPAF access" : "Continue your assessment"}</h3>
              <p id="account-description">{authMode === "register" ? "IOPAF uses one secure screen for sign in or sign up. Enter a new email—or continue with Google, Microsoft or Apple—to create access, then return directly to the portal." : "Continue to the protected account screen and use your existing email, passkey or identity provider. You will return directly to the portal."}</p>
              <button className="button button-primary button-wide account-continue" onClick={continueToSecureAccount}>{authMode === "register" ? "Continue to sign in or sign up" : "Continue to secure sign in"}</button>
              <div className="account-assurance"><b>SECURE HANDOFF</b><span>Credentials protected by the identity provider</span><span>Session cookie restricted to this application</span><span>Assessment engine remains access-controlled</span></div>
            </div>
          </div>
        </div>
      )}

      <footer className="site-footer"><div className="wordmark footer-mark"><span>IOPAF</span><i aria-hidden="true" /><small>Draft assessment framework</small></div><p>Developed by <strong>Shabir Murtaza (MSc &amp; PhD – Transformation &amp; Innovation)</strong>. For review and pilot use; content, scoring rules and mappings may change.</p><div className="footer-links"><a href="#top">Back to top</a><button onClick={isAuthenticated ? openPortal : (event) => openAuth("signin", event.currentTarget)}>{isAuthenticated ? "Open engine" : "Register / Sign in"}</button></div></footer>
    </div>
  );
}
