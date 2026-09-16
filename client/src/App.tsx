import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

/**
 * Every route is split out.
 *
 * Statically importing all five put the landing page, the protected portal,
 * sign-in and the callback into one entry bundle, so a visitor who only reads
 * the public site still downloaded the portal, and an assessor going straight
 * to /portal still downloaded the marketing page.
 */
const Home = lazy(() => import("./pages/Home"));
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
