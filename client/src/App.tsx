import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

/**
 * Home is imported statically; everything else is split out.
 *
 * Splitting all five looked better on paper and measured worse. Home is what
 * a public visitor lands on, and making it lazy meant the browser fetched the
 * entry, mounted React, and only then discovered it needed Home — a second
 * round trip that pushed content from about 2.4s to 3.2s on a high-latency
 * connection. It also gained nothing: Home reaches useAuth, which reaches
 * supabase, so that chunk downloaded on the public page regardless, just later.
 *
 * The real saving was never Home. It is keeping Portal, its Copilot panel and
 * the assessment backup off the public page, and those stay lazy below.
 */
import Home from "./pages/Home";

const Portal = lazy(() => import("./pages/Portal"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * Deliberately neutral: this shows on the public site as well as the portal,
 * so it must not claim to be loading a secure workspace.
 */
function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span>IOPAF</span>
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/portal"} component={Portal} />
        <Route path={"/login"} component={Login} />
        <Route path={"/auth/callback"} component={AuthCallback} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
