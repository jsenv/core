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
    clearAllRoutes();
    const sectionSignal = stateSignal("settings");
    const tabSignal = stateSignal("general");
    const analyticsTabSignal = stateSignal("overview");
    registerRoute("/");
    const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = registerRoute(
      `/admin/settings/:tab=${tabSignal}`,
    );
    const ADMIN_ANALYTICS_ROUTE = registerRoute(
      `/admin/analytics/?tab=${analyticsTabSignal}`,
    );
    const run = (route, relativeUrl) => {
      updateRoutes(`${baseUrl}${relativeUrl}`);
      return route.matching ? route.params : null;
    };

    // Test various URL matching scenarios
    const testResults = {
      // Admin route tests - basic parameter matching with defaults
      admin_root_matches_section_default: run(ADMIN_ROUTE, `/admin`),
      admin_root_with_slash: run(ADMIN_ROUTE, `/admin/`),
      admin_with_settings_section: run(ADMIN_ROUTE, `/admin/settings/advanced`),
      admin_with_users_section: run(ADMIN_ROUTE, `/admin/users/`),
      admin_users_without_trailing_slash: run(ADMIN_ROUTE, `/admin/users`),

      // Settings route tests - inheritance and parameter handling
      settings_route_matches_admin_root: run(ADMIN_SETTINGS_ROUTE, `/admin`),
      settings_root_without_slash: run(ADMIN_SETTINGS_ROUTE, `/admin`),
      settings_root_with_slash: run(ADMIN_SETTINGS_ROUTE, `/admin/`),
      settings_with_general_tab: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/settings/general`,
      ),
      settings_with_security_tab: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/settings/security`,
      ),
      settings_with_literal_settings_path: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/settings`,
      ),
      settings_with_wrong_search_param: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin?wrongParam=value`,
      ),
      settings_should_not_match_analytics_url: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/analytics`,
      ),
      settings_should_not_match_users_url: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/users`,
      ),
      settings_with_different_section: run(
        ADMIN_SETTINGS_ROUTE,
        `/admin/different`,
      ),

      // Analytics route tests - inheritance and search parameters
      analytics_with_overview_tab: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/analytics`,
      ),
      analytics_with_performance_tab: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/analytics?tab=performance`,
      ),
      analytics_root_without_slash: run(ADMIN_ANALYTICS_ROUTE, `/admin`),
      analytics_root_with_slash: run(ADMIN_ANALYTICS_ROUTE, `/admin/`),
      analytics_with_literal_analytics_path: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/analytics`,
      ),
      analytics_with_wrong_search_param: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin?wrongParam=value`,
      ),
      analytics_should_not_match_settings_url: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/settings`,
      ),
      analytics_should_not_match_users_url: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/users`,
      ),
      analytics_with_different_section: run(
        ADMIN_ANALYTICS_ROUTE,
        `/admin/different`,
      ),
    };

    clearAllRoutes();

    return testResults;
  });
});
