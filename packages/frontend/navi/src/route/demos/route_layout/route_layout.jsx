import {
  Route,
  RouteLink,
  Routes,
  setupRoutes,
  UITransition,
} from "@jsenv/navi";
import { useLayoutEffect } from "preact/hooks";

// External state to track renders across mount/unmount cycles
const componentStats = new Map();

const getComponentStats = (name) => {
  if (!componentStats.has(name)) {
    componentStats.set(name, { renders: 0, layoutEffects: 0 });
  }
  return componentStats.get(name);
};

// Simple component tracker
const ComponentTracker = ({ name, color = "#333", children }) => {
  const stats = getComponentStats(name);
  stats.renders++;

  useLayoutEffect(() => {
    stats.layoutEffects++;
  });

  return (
    <div
      style={{
        background: color,
        color: "white",
        padding: "8px",
        margin: "5px 0",
        borderRadius: "4px",
      }}
    >
      <div style={{ fontSize: "12px", marginBottom: "5px" }}>
        <strong>{name}</strong> - Renders: {stats.renders} | LayoutEffects:{" "}
        {stats.layoutEffects}
      </div>
      {children}
    </div>
  );
};

const {
  HOME_ROUTE,
  AUTH_ANY_ROUTE,
  AUTH_INDEX_ROUTE,
  LOGIN_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  NO_MATCH_AUTH_ROUTE,
  NO_MATCH_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  AUTH_ANY_ROUTE: "auth/*",
  AUTH_INDEX_ROUTE: "auth/",
  LOGIN_ROUTE: "auth/login",
  FORGOT_PASSWORD_ROUTE: "auth/forgot",
  NO_MATCH_AUTH_ROUTE: "auth/no_match",
  NO_MATCH_ROUTE: "toto",
});

// Test App
export const App = () => {
  console.debug("🚀 App component rendering...");

  return (
    <div>
      <h1>Route System Test with Discovery Optimization</h1>

      <div className="debug">
        <h3>🔍 Debug Information</h3>
        <p>
          <strong>Expected behavior during discovery:</strong>
        </p>
        <ul>
          <li>✅ All components should execute (you will see render logs)</li>
          <li>✅ Expensive computations should run (discovery needs them)</li>
          <li>❌ Only active routes should appear in DOM</li>
          <li>❌ Inactive routes should NOT trigger DOM effects</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="nav">
        <RouteLink box width="30" height="auto" route={HOME_ROUTE}>
          <HomeSvg />
        </RouteLink>
        <RouteLink route={NO_MATCH_ROUTE}>No match</RouteLink>
        <RouteLink route={AUTH_INDEX_ROUTE}>Auth index</RouteLink>
        <RouteLink route={LOGIN_ROUTE}>Login</RouteLink>
        <RouteLink route={FORGOT_PASSWORD_ROUTE}>Forgot password</RouteLink>
        <RouteLink route={NO_MATCH_AUTH_ROUTE}>No match auth</RouteLink>
      </div>

      <main>
        <Routes>
          <Route
            route={HOME_ROUTE}
            element={
              <div
                id="home"
                style="background: #e8f5e8; padding: 15px; border-radius: 5px;"
              >
                <h3>🏠 Homepage Content</h3>
                <ComponentTracker name="HomePage" color="#28a745" />
                <p>This is the homepage!</p>
              </div>
            }
          />
          <Route
            // route={AUTH_ROUTE}
            element={
              <div
                id="auth_layout"
                style="background: #e6f3ff; padding: 15px; border-radius: 5px;"
              >
                <h3>🔐 Auth Section Wrapper</h3>
                <ComponentTracker name="AuthWrapper" color="#17a2b8" />
                <p>
                  This wrapper should only render when one of the auth routes is
                  active:
                </p>

                <UITransition debugTransition>
                  <Route.Slot />
                </UITransition>

                <p>
                  <em>End of auth section</em>
                </p>
              </div>
            }
          >
            <Route
              route={AUTH_INDEX_ROUTE}
              element={<div id="auth_index">Auth index</div>}
            />
            <Route
              route={LOGIN_ROUTE}
              element={
                <div
                  id="login"
                  style="background: #fff3cd; padding: 10px; margin: 10px 0; border: 1px solid #ffc107;"
                >
                  <h4>Login Form</h4>
                  <ComponentTracker name="LoginForm" color="#ffc107" />

                  <p>Enter your credentials here</p>
                </div>
              }
            />
            <Route
              route={FORGOT_PASSWORD_ROUTE}
              element={
                <div
                  id="forgot_password"
                  style="background: #f8d7da; padding: 10px; margin: 10px 0; border: 1px solid #dc3545;"
                >
                  <h4>Password Reset</h4>
                  <ComponentTracker name="ForgotForm" color="#dc3545" />

                  <p>Reset your password here</p>
                </div>
              }
            />
            <Route
              fallback
              // route={AUTH_ANY_ROUTE}
              element={
                <div id="auth_fallback">No matching auth route found.</div>
              }
            />
          </Route>
          <Route
            fallback
            element={<div id="root_fallback">404 - Page Not Found</div>}
          />
        </Routes>
      </main>

      <div className="debug">
        <h2>🧪 Testing Scenarios</h2>
        <ul>
          <li>
            <strong>Home (#/):</strong> Only homepage content should be visible
            in DOM
            <br />
            Expected logs: App, HomePage, HomeExpensive renders
          </li>
          <li>
            <strong>Login (#/login):</strong> Auth wrapper + login form should
            be visible
            <br />
            Expected logs: App, AuthWrapper, LoginForm, LoginExpensive renders
          </li>
          <li>
            <strong>Forgot (#/forgot):</strong> Auth wrapper + forgot form
            should be visible
            <br />
            Expected logs: App, AuthWrapper, ForgotForm, ForgotExpensive renders
          </li>
          <li>
            <strong>Profile (#/profile):</strong> Only profile content should be
            visible
            <br />
            Expected logs: App, ProfilePage, ProfileExpensive renders
          </li>
        </ul>

        <h3>⚠️ What to watch for:</h3>
        <ul>
          <li>
            <strong>Discovery phase:</strong> All components render but only
            active ones appear in DOM
          </li>
          <li>
            <strong>useLayoutEffect calls:</strong> Should only happen for
            visible components
          </li>
          <li>
            <strong>DOM insertion count:</strong> Should be 1 for visible, 0 for
            hidden
          </li>
          <li>
            <strong>Performance:</strong> No flash of inactive content
          </li>
        </ul>
      </div>
    </div>
  );
};

const HomeSvg = () => (
  <svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 22v-7h6v7h6v-10h3L12 1 0 12h3v10z" fill="currentColor" />
  </svg>
);
