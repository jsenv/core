import { snapshotTests } from "@jsenv/snapshot";
import { stateSignal } from "../state/state_signal.js";
import {
  clearAllRoutes,
  registerRoute,
  setBaseUrl,
  updateRoutes,
} from "./route.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const run = (patternOrRoute, relativeUrl) => {
  let route;
  if (typeof patternOrRoute === "string") {
    route = registerRoute(patternOrRoute);
  } else {
    route = patternOrRoute;
  }
  updateRoutes(`${baseUrl}${relativeUrl}`);

  const result = route.matching ? route.params : null;
  clearAllRoutes();

  return result;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic", () => {
    return {
      matching_url: run("/users/:id", `/users/123`),
      non_matching_url: run("/users/:id", `/admin`),
    };
  });

  test("state signal", () => {
    const sectionSignal = stateSignal("settings");
    return {
      matching_with_default: run(`/admin/:section=${sectionSignal}`, `/admin`),
      matching_with_param: run(
        `/admin/:section=${sectionSignal}`,
        `/admin/users`,
      ),
      non_matching_url: run(`/admin/:section=${sectionSignal}`, `/different`),
    };
  });

  test("url defaults with nested routes", () => {
    // Helper function that re-creates routes for each test case
    const runWithFreshRoutes = (routeType, relativeUrl) => {
      clearAllRoutes();

      const sectionSignal = stateSignal("settings");
      const tabSignal = stateSignal("general");
      const analyticsTabSignal = stateSignal("overview");

      // Re-register all routes for each test
      registerRoute("/");
      const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
      const ADMIN_SETTINGS_ROUTE = registerRoute(
        `/admin/settings/:tab=${tabSignal}`,
      );
      const ADMIN_ANALYTICS_ROUTE = registerRoute(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
      );

      // Select the target route by type
      let targetRoute;
      if (routeType === "admin") {
        targetRoute = ADMIN_ROUTE;
      } else if (routeType === "settings") {
        targetRoute = ADMIN_SETTINGS_ROUTE;
      } else if (routeType === "analytics") {
        targetRoute = ADMIN_ANALYTICS_ROUTE;
      }

      updateRoutes(`${baseUrl}${relativeUrl}`);
      return targetRoute.matching ? targetRoute.params : null;
    };

    // Test various URL matching scenarios
    const testResults = {
      // Test basic parameter with default - should match "/admin"
      admin_root_matches_section_default: runWithFreshRoutes("admin", `/admin`),
      admin_root_with_slash: runWithFreshRoutes("admin", `/admin/`),
      admin_with_users_section: runWithFreshRoutes("admin", `/admin/users/`),

      // CRITICAL TEST: This should match because "settings" is the default value for :section
      // /admin/settings/:tab should match /admin because settings=default(section)
      settings_route_matches_admin_root: runWithFreshRoutes(
        "settings",
        `/admin`,
      ),

      settings_with_general_tab: runWithFreshRoutes(
        "settings",
        `/admin/settings/general`,
      ),
      settings_with_security_tab: runWithFreshRoutes(
        "settings",
        `/admin/settings/security`,
      ),

      analytics_with_overview_tab: runWithFreshRoutes(
        "analytics",
        `/admin/analytics`,
      ),
      analytics_with_performance_tab: runWithFreshRoutes(
        "analytics",
        `/admin/analytics?tab=performance`,
      ),
    };

    clearAllRoutes();

    return testResults;
  });
});
