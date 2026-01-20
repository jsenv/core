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

const run = (pattern, relativeUrl) => {
  const route = registerRoute(pattern);
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
    const routes = [
      registerRoute("/"),
      registerRoute(`/admin/:section=${sectionSignal}/`),
      registerRoute(`/admin/settings/:tab=${tabSignal}`),
      registerRoute(`/admin/analytics/?tab=${analyticsTabSignal}`),
    ];

    // Check that original patterns are preserved (not transformed to parameters)
    const patterns = routes.map((route) => route.urlPattern);

    // Test various URL matching scenarios
    const testResults = {
      preserved_patterns: patterns,

      // Test basic parameter with default - should match "/admin"
      admin_root_matches_section_default: run(
        `/admin/:section=${sectionSignal}/`,
        `/admin`,
      ),
      admin_root_with_slash: run(
        `/admin/:section=${sectionSignal}/`,
        `/admin/`,
      ),
      admin_with_users_section: run(
        `/admin/:section=${sectionSignal}/`,
        `/admin/users/`,
      ),

      // Test settings route with tab parameter
      settings_with_general_tab: run(
        `/admin/settings/:tab=${tabSignal}`,
        `/admin/settings/general`,
      ),
      settings_with_security_tab: run(
        `/admin/settings/:tab=${tabSignal}`,
        `/admin/settings/security`,
      ),

      // Test analytics route with query parameter
      analytics_with_overview_tab: run(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
        `/admin/analytics`,
      ),
      analytics_with_performance_tab: run(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
        `/admin/analytics?tab=performance`,
      ),
    };

    clearAllRoutes();

    return testResults;
  });
});
