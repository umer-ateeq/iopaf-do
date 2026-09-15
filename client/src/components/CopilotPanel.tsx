import { AIChatBox } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { Bot, Expand, Minimize2, RotateCcw, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type CopilotContext = {
  page: "setup" | "journey" | "standards" | "assess" | "controls" | "results" | "reports" | "framework" | "home" | "unknown";
  stream: "sdlc" | "tmmi" | "operations" | "iam" | "none";
  mode: "question" | "practice" | "control" | "risk" | "result" | "remediation" | "general";
  practice?: Record<string, unknown>;
  question?: Record<string, unknown>;
  control?: Record<string, unknown>;
  risk?: Record<string, unknown>;
  remediation?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  expanded: boolean;
  context: CopilotContext;
  initialView?: "chat" | "settings";
  onClose: () => void;
  onExpandedChange: (value: boolean) => void;
  onSettingsChanged?: (settings: Record<string, unknown>) => void;
  requestedPrompt?: { id: number; content: string } | null;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const EMPTY_CONTEXT: CopilotContext = { page: "unknown", stream: "none", mode: "general" };

function contextTitle(context: CopilotContext) {
  const control = context.control as { id?: string; statement?: string; target?: string } | undefined;
  const question = context.question as { dimension?: string; text?: string } | undefined;
  const practice = context.practice as { name?: string } | undefined;
  if (control?.id) return `${control.id} · ${control.target || "Control assessment"}`;
  if (question?.text) return `${question.dimension || "Question"} · ${question.text}`;
  if (practice?.name) return practice.name;
  return context.page === "unknown" ? "General IOPAF guidance" : `${context.page} · ${context.mode}`;
}

function promptSet(context: CopilotContext) {
  if (context.mode === "control") return [
    "Explain this control requirement in plain language.",
    "What evidence should I request and how should I test it?",
    "What is the gap to L4 for this target?",
    "Draft a measurable remedial action and closure evidence.",
  ];
  if (context.mode === "remediation") return [
    "Improve this remedial action so it is measurable.",
    "Suggest an accountable owner role and realistic sequencing.",
    "What closure evidence should be required?",
  ];
  if (context.mode === "risk") return [
    "Explain this Bayesian result without overstating certainty.",
    "Which control evidence most influences this scenario?",
    "What would reduce the High-or-above risk probability?",
  ];
  if (context.mode === "question" || context.mode === "practice") return [
    "Explain this assessment question in plain language.",
    "Explain the cited standard reference and its assessment intent.",
    "What evidence would substantiate L3 or L4?",
    "What is missing between the current result and the next level?",
  ];
  return [
    "Explain how IOPAF evidence-gated maturity works.",
    "How do the SDLC, TMMi, Operations and IAM streams connect?",
    "Explain the audited Bayesian risk model and its limits.",
  ];
}

export function CopilotPanel({
  open,
  expanded,
  context = EMPTY_CONTEXT,
  initialView = "chat",
  onClose,
  onExpandedChange,
  onSettingsChanged,
  requestedPrompt,
}: Props) {
  const [view, setView] = useState<"chat" | "settings">(initialView);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const settingsQuery = trpc.copilot.settings.useQuery(undefined, { enabled: open });
  const modelsQuery = trpc.copilot.models.useQuery(undefined, { enabled: open });

  // The provider credential belongs to the platform, so the only things a
  // user controls are the switch, the catalogue model and the privacy scope.
  const [form, setForm] = useState({
    enabled: true,
    model: "",
    includeCurrentResponse: false,
    includeRemediation: false,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const { enabled, model, includeCurrentResponse, includeRemediation } = settingsQuery.data;
    setForm({ enabled, model, includeCurrentResponse, includeRemediation });
  }, [settingsQuery.data]);

  useEffect(() => setView(initialView), [initialView, open]);
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !expanded || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"
      )).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", keydown);
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    };
  }, [open, expanded, onClose]);

  const saveMutation = trpc.copilot.saveSettings.useMutation({
    onSuccess: data => {
      setStatus("Settings saved.");
      setForm({
        enabled: data.enabled,
        model: data.model,
        includeCurrentResponse: data.includeCurrentResponse,
        includeRemediation: data.includeRemediation,
      });
      onSettingsChanged?.(data as unknown as Record<string, unknown>);
    },
    onError: error => setStatus(error.message),
  });
  const testMutation = trpc.copilot.testConnection.useMutation({
    onSuccess: data => setStatus(data?.detail || "Connection verified."),
    onError: error => setStatus(error.message),
  });
  const chatMutation = trpc.copilot.chat.useMutation({
    onSuccess: data => {
      if (data?.content) setMessages(current => [...current, { role: "assistant", content: data.content }]);
    },
  });

  const models = modelsQuery.data || [];
  const prompts = useMemo(() => promptSet(context), [context]);
  const serverConfigured = settingsQuery.data?.serverConfigured !== false;
  // False when the server has no settings database; Save cannot succeed.
  const settingsStorable = settingsQuery.data?.settingsStorable !== false;
  const send = (content: string) => {
    const next = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(next);
    chatMutation.mutate({ messages: next, context });
  };

  if (!open) return null;

  return (
    <div className={expanded ? "copilot-backdrop" : "copilot-layer"} onMouseDown={event => {
      if (expanded && event.target === event.currentTarget) onClose();
    }}>
      <aside ref={panelRef} className={`copilot-panel ${expanded ? "is-expanded" : ""}`} role="dialog" aria-modal={expanded} aria-label="IOPAF AI Copilot">
        <header className="copilot-head">
          <div className="copilot-brand"><Bot aria-hidden="true" /><span><b>IOPAF AI Copilot</b><small>Assessment guidance · advisory only</small></span></div>
          <div className="copilot-head-actions">
            <button onClick={() => setMessages([])} aria-label="Start a new Copilot conversation"><RotateCcw /></button>
            <button onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? "Return to side panel" : "Expand Copilot"}>{expanded ? <Minimize2 /> : <Expand />}</button>
            <button ref={closeRef} onClick={onClose} aria-label="Close Copilot"><X /></button>
          </div>
        </header>

        <div className="copilot-context" title={contextTitle(context)} data-page={context.page} data-stream={context.stream} data-mode={context.mode}>
          <span>{context.stream === "none" ? "IOPAF" : context.stream.toUpperCase()}</span>
          <b>{contextTitle(context)}</b>
        </div>

        <nav className="copilot-tabs" aria-label="Copilot views">
          <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}>Conversation</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings aria-hidden="true" /> Setup</button>
        </nav>

        {view === "chat" ? (
          <div className="copilot-chat-view">
            {!serverConfigured && <div className="copilot-notice">The AI Copilot is not configured on this server. Contact your administrator.</div>}
            {serverConfigured && !settingsQuery.data?.enabled && <div className="copilot-notice">Copilot is disabled. Enable it in Setup.</div>}
            {chatMutation.error && <div className="copilot-error" role="alert">{chatMutation.error.message}</div>}
            <AIChatBox
              messages={messages}
              onSendMessage={send}
              isLoading={chatMutation.isPending}
              height="100%"
              className="copilot-chat"
              placeholder="Ask about this assessment context…"
              emptyStateMessage="Ask about the active question, standard, evidence, risk or remedial action."
              suggestedPrompts={prompts}
              inputSeed={requestedPrompt}
              richMarkdown={false}
            />
            <div className="copilot-footnote"><ShieldCheck aria-hidden="true" /> Current assessment data is included only according to your Setup privacy choices.</div>
          </div>
        ) : (
          <form className="copilot-settings" onSubmit={event => { event.preventDefault(); saveMutation.mutate(form); }}>
            <div className="copilot-setting-lead"><b>AI assistance</b><p>The IOPAF platform provides the model connection. Choose the model and how much of your assessment may be included in a request.</p></div>
            {!serverConfigured && <div className="copilot-notice">No model connection is configured on this server, so Copilot requests will fail until an administrator adds one.</div>}
            {serverConfigured && !settingsStorable && <div className="copilot-notice">This server has no settings database, so these choices cannot be saved. The Copilot still answers using the platform defaults.</div>}
            <label className="copilot-toggle"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} /><span>Enable IOPAF Copilot</span></label>
            <label>
              <span>Model</span>
              <select value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} disabled={modelsQuery.isPending || !models.length}>
                {models.length
                  ? models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)
                  : <option value={form.model}>{form.model || "Loading models…"}</option>}
              </select>
              <small>{modelsQuery.error ? modelsQuery.error.message : "Catalogue loaded from the platform's provider account."}</small>
            </label>
            <fieldset><legend>Context privacy</legend><label className="copilot-toggle"><input type="checkbox" checked={form.includeCurrentResponse} onChange={event => setForm({ ...form, includeCurrentResponse: event.target.checked })} /><span>Include current ratings, evidence summaries and risk values</span></label><label className="copilot-toggle"><input type="checkbox" checked={form.includeRemediation} onChange={event => setForm({ ...form, includeRemediation: event.target.checked })} /><span>Include the active remediation text</span></label></fieldset>
            {status && <div className="copilot-status" role="status">{status}</div>}
            <div className="copilot-settings-actions"><button type="button" onClick={() => testMutation.mutate(form)} disabled={testMutation.isPending}>{testMutation.isPending ? "Testing…" : "Test connection"}</button><button type="submit" className="primary" disabled={saveMutation.isPending || !settingsStorable} title={settingsStorable ? undefined : "No settings database is configured on this server"}>{saveMutation.isPending ? "Saving…" : "Save settings"}</button></div>
          </form>
        )}
      </aside>
    </div>
  );
}
