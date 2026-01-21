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
  clearAllRoutes();

  return route.matching ? route.params : null;
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

  test("route optimization with multiple routes", () => {
    // Clear routes to start fresh
    clearAllRoutes();

    // Test the pattern combinations that were problematic
    const sectionSignal = stateSignal("settings");
    const tabSignal = stateSignal("general");
    const analyticsTabSignal = stateSignal("overview");

    // Register routes using explicit parameter syntax
    registerRoute("/");
    const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = registerRoute(
      `/admin/settings/:tab=${tabSignal}`,
    );
    const ADMIN_ANALYTICS_ROUTE = registerRoute(
      `/admin/analytics/?tab=${analyticsTabSignal}`,
    );

    // Test various URL matching scenarios
    const testResults = {
      // Test basic parameter with default - should match "/admin"
      admin_root_matches_section_default: run(ADMIN_ROUTE, `/admin`),
      admin_root_with_slash: run(ADMIN_ROUTE, `/admin/`),
      admin_with_users_section: run(ADMIN_ROUTE, `/admin/users/`),

      // CRITICAL TEST: This should match because "settings" is the default value for :section
      // /admin/settings/:tab should match /admin because settings=default(section)
      settings_route_matches_admin_root: run(ADMIN_SETTINGS_ROUTE, `/admin`),

      settings_with_general_tab: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/settings/general`,
      ),
      settings_with_security_tab: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/settings/security`,
      ),
      analytics_with_overview_tab: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/analytics`,
      ),
      analytics_with_performance_tab: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/analytics?tab=performance`,
      ),
    };

    clearAllRoutes();

    return testResults;
  });
});
