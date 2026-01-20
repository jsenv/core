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

  test("literal segment preservation", () => {
    // Clear routes to start fresh
    clearAllRoutes();

    // Test the pattern combinations that were problematic
    const sectionSignal = stateSignal("section", { defaultValue: "settings" });
    const tabSignal = stateSignal("tab", { defaultValue: "general" });
    const analyticsTabSignal = stateSignal("tab", { defaultValue: "overview" });

    // Register routes in problematic order
    const routes = [
      registerRoute("/"),
      registerRoute(`/admin/${sectionSignal}/`),
      registerRoute(`/admin/settings/${tabSignal}`),
      registerRoute(`/admin/analytics/?tab=${analyticsTabSignal}`),
    ];

    // Check that original patterns are preserved (not transformed to parameters)
    const patterns = routes.map((route) => route.urlPattern);

    clearAllRoutes();

    return {
      preserved_patterns: patterns,
      // Also test that the settings route still works correctly
      settings_with_tab: run(
        `/admin/settings/${tabSignal}`,
        `/admin/settings/security`,
      ),
      analytics_with_tab: run(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
        `/admin/analytics?tab=performance`,
      ),
    };
  });
});
