import { useAuth } from "@/_core/hooks/useAuth";
import type { CopilotContext } from "@/components/CopilotPanel";

/**
 * Loaded on the first "Ask IOPAF" click rather than with the portal, so the
 * panel and its chat dependencies cost nothing to an assessor who never opens
 * it. Kept mounted afterwards so the conversation survives closing the drawer.
 */
const CopilotPanel = lazy(() =>
  import("@/components/CopilotPanel").then(m => ({ default: m.CopilotPanel }))
);
import { Bot } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAssessmentBackup } from "@/lib/useAssessmentBackup";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

/**
 * Settings the protected engine's own Setup card can save. The platform owns
 * the provider credential, so this deliberately carries no endpoint or key.
 */
type NativeCopilotSettings = {
  enabled: boolean;
  model: string;
  includeCurrentResponse: boolean;
  includeRemediation: boolean;
};

type EngineCopilotMessage = {
  type?: string;
  context?: CopilotContext;
  prompt?: string;
  requestId?: string;
  settings?: NativeCopilotSettings;
};

export default function Portal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const signingOutRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  /** Latches on first open so the chunk is fetched once and state persists. */
  const [copilotMounted, setCopilotMounted] = useState(false);
  const [copilotExpanded, setCopilotExpanded] = useState(false);
  const [copilotView, setCopilotView] = useState<"chat" | "settings">("chat");
  const [copilotContext, setCopilotContext] = useState<CopilotContext>({ page: "unknown", stream: "none", mode: "general" });
  const [copilotPrompt, setCopilotPrompt] = useState<{ id: number; content: string } | null>(null);
  const utils = trpc.useUtils();
  // staleTime is what stops these being fetched twice. CopilotPanel asks for
  // the same two queries when it opens, and without a freshness window React
  // Query would treat the cached copy as stale and go back to the provider.
  // The catalogue is also cached server-side for 15 minutes, so the two
  // windows agree.
  const settingsQuery = trpc.copilot.settings.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
  const modelsQuery = trpc.copilot.models.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 15 * 60_000,
  });
  const nativeSave = trpc.copilot.saveSettings.useMutation();
  const nativeTest = trpc.copilot.testConnection.useMutation();
  const settingsRef = useRef(settingsQuery.data);
  const modelsRef = useRef(modelsQuery.data);
  const nativeSaveRef = useRef(nativeSave.mutateAsync);
  const nativeTestRef = useRef(nativeTest.mutateAsync);
  const postToEngine = (message: Record<string, unknown>) => iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  const sendSettings = () => {
    if (settingsRef.current) postToEngine({ type: "IOPAF_COPILOT_SETTINGS_STATE", settings: settingsRef.current });
  };
  const sendModels = () => {
    if (modelsRef.current) postToEngine({ type: "IOPAF_COPILOT_MODELS_STATE", models: modelsRef.current });
  };

  useEffect(() => {
    if (loading || isAuthenticated || signingOutRef.current) return;
    window.location.replace("/?auth=required");
  }, [loading, isAuthenticated]);

  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as EngineCopilotMessage;
      if (data.type === "IOPAF_COPILOT_CONTEXT" && data.context) setCopilotContext(data.context);
      if (data.type === "IOPAF_COPILOT_OPEN") {
        if (data.context) setCopilotContext(data.context);
        setCopilotPrompt(data.prompt ? { id: Date.now(), content: data.prompt.slice(0, 4000) } : null);
        setCopilotView("chat");
        setCopilotMounted(true); setCopilotOpen(true);
      }
      if (data.type === "IOPAF_COPILOT_SETTINGS") { setCopilotView("settings"); setCopilotMounted(true); setCopilotOpen(true); }
      if (data.type === "IOPAF_COPILOT_SETTINGS_REQUEST") { sendSettings(); sendModels(); }
      if (data.type === "IOPAF_COPILOT_MODELS_REQUEST") {
        const result = await modelsQuery.refetch();
        if (result.data) {
          modelsRef.current = result.data;
          sendModels();
        }
      }
      if ((data.type === "IOPAF_COPILOT_SAVE_SETTINGS" || data.type === "IOPAF_COPILOT_TEST_CONNECTION") && data.settings) {
        try {
          const result = data.type === "IOPAF_COPILOT_SAVE_SETTINGS"
            ? await nativeSaveRef.current(data.settings)
            : await nativeTestRef.current(data.settings);
          if (data.type === "IOPAF_COPILOT_SAVE_SETTINGS" && result && "model" in result) {
            settingsRef.current = result;
            utils.copilot.settings.setData(undefined, result);
            sendSettings();
          }
          postToEngine({ type: "IOPAF_COPILOT_SETTINGS_RESULT", requestId: data.requestId, action: data.type === "IOPAF_COPILOT_SAVE_SETTINGS" ? "save" : "test", ok: true, result });
        } catch (error) {
          postToEngine({ type: "IOPAF_COPILOT_SETTINGS_RESULT", requestId: data.requestId, action: data.type === "IOPAF_COPILOT_SAVE_SETTINGS" ? "save" : "test", ok: false, error: error instanceof Error ? error.message : "The secure Copilot request failed" });
        }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    settingsRef.current = settingsQuery.data;
    sendSettings();
  }, [settingsQuery.data]);

  useEffect(() => {
    modelsRef.current = modelsQuery.data;
    sendModels();
  }, [modelsQuery.data]);

  useEffect(() => {
    nativeSaveRef.current = nativeSave.mutateAsync;
    nativeTestRef.current = nativeTest.mutateAsync;
  }, [nativeSave.mutateAsync, nativeTest.mutateAsync]);

  // Mirrors the engine's autosaved assessment into Supabase and brings it
  // back on a new browser. Reads the same localStorage key the engine writes,
  // so the protected engine file is untouched.
  const backup = useAssessmentBackup(isAuthenticated);

  // A restore rewrites localStorage after the engine has already booted, so the
  // frame has to re-read it. This only fires on the first pass, before the
  // user can have entered anything into the running engine.
  useEffect(() => {
    if (!backup.needsEngineReload) return;
    backup.acknowledgeReload();
    const frame = iframeRef.current;
    if (frame) frame.src = frame.src;
  }, [backup.needsEngineReload, backup.acknowledgeReload]);

  const backupLabel = (() => {
    switch (backup.status.state) {
      case "syncing": return "Backing up…";
      case "saved": return "Backed up";
      case "restored": return "Restored from backup";
      case "too-large":
        return `Too large to back up (${(backup.status.bytes / 1048576).toFixed(1)} MB of ${(backup.status.limit / 1048576).toFixed(0)} MB)`;
      case "conflict": return "Open on another device";
      case "error": return "Backup unavailable";
      default: return null;
    }
  })();

  const signOut = async () => {
    signingOutRef.current = true;
    await logout();
    window.location.replace("/");
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="portal-gate" role="status">
        <div className="portal-gate-rule" />
        <span>IOPAF SECURE ACCESS</span>
        <h1>Verifying your session…</h1>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <header className="portal-bar">
        <a className="wordmark" href="/" aria-label="Return to IOPAF website">
          <span>IOPAF</span><i aria-hidden="true" /><small>Protected assessment workspace</small>
        </a>
        <div className="portal-user">
          {backupLabel && (
            <span
              className={`portal-backup portal-backup-${backup.status.state}`}
              title={
                backup.status.state === "error"
                  ? "This assessment is still saved in this browser, but could not be copied to your account."
                  : backup.status.state === "conflict"
                    ? "This assessment is being edited in another browser or device. Nothing was overwritten, and every version is kept in your account."
                    : backup.status.state === "too-large"
                    ? "Export the assessment to keep a copy. Evidence attachments are what usually push it past the limit."
                    : "Your assessment is copied to your IOPAF account so it survives this browser."
              }
            >
              {backupLabel}
            </span>
          )}
          <span>{user?.name || user?.email || "Authenticated user"}</span>
          <button className="portal-copilot-button" onClick={() => { setCopilotPrompt(null); setCopilotView("chat"); setCopilotMounted(true); setCopilotOpen(true); }}><Bot aria-hidden="true" /> Ask IOPAF</button>
          <a href="/">Website</a>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>
      <iframe
        ref={iframeRef}
        className="portal-frame"
        src="/app.html"
        title="IOPAF assessment portal"
        referrerPolicy="same-origin"
        onLoad={() => { sendSettings(); sendModels(); }}
      />
      {copilotMounted && (
        <Suspense fallback={null}>
          <CopilotPanel
            open={copilotOpen}
            expanded={copilotExpanded}
            context={copilotContext}
            initialView={copilotView}
            onClose={() => { setCopilotOpen(false); setCopilotExpanded(false); }}
            onExpandedChange={setCopilotExpanded}
            onSettingsChanged={settings => iframeRef.current?.contentWindow?.postMessage({ type: "IOPAF_COPILOT_SETTINGS_STATE", settings }, window.location.origin)}
            requestedPrompt={copilotPrompt}
          />
        </Suspense>
      )}
    </div>
  );
}
