import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes, updateRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const match = (route, relativeUrl) => {
  updateRoutes(`${baseUrl}${relativeUrl}`);
  const result = route.matching ? route.params : null;
  return result;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic", () => {
    try {
      const { USER_ROUTE } = setupRoutes({
        USER_ROUTE: "/users/:id",
      });
      return {
        matching_url: match(USER_ROUTE, `/users/123`),
        non_matching_url: match(USER_ROUTE, `/admin`),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("state signal", () => {
    try {
      const sectionSignal = stateSignal("settings", {
        id: "state_signal_section",
      });
      const { ADMIN_ROUTE } = setupRoutes({
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}`,
      });
      return {
        matching_with_default: match(ADMIN_ROUTE, `/admin`),
        matching_with_param: match(ADMIN_ROUTE, `/admin/users`),
        non_matching_url: match(ADMIN_ROUTE, `/different`),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url defaults with nested routes", () => {
    try {
      const sectionSignal = stateSignal("settings", { id: "nested_section" });
      const tabSignal = stateSignal("general", { id: "nested_tab" });
      const analyticsTabSignal = stateSignal("overview", {
        id: "nested_analytics_tab",
      });
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE, ADMIN_ANALYTICS_ROUTE } =
        setupRoutes({
          ROOT: "/",
          ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
          ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
          ADMIN_ANALYTICS_ROUTE: `/admin/analytics/?tab=${analyticsTabSignal}`,
        });
      return {
        // Admin route tests - basic parameter matching with defaults
        admin_root_matches_section_default: match(ADMIN_ROUTE, `/admin`),
        admin_root_with_slash: match(ADMIN_ROUTE, `/admin/`),
        admin_on_settings: match(ADMIN_ROUTE, `/admin/settings`),
        admin_on_settings_trailing_slash: match(
          ADMIN_ROUTE,
          "/admin/settings/",
        ),
        admin_on_settings_tab: match(ADMIN_ROUTE, `/admin/settings/advanced`),
        admin_on_analytics: match(ADMIN_ROUTE, `/admin/analytics`),
        admin_on_analytics_tab: match(
          ADMIN_ROUTE,
          `/admin/analytics?tab=details`,
        ),
        admin_on_analytics_trailing_slash_tab: match(
          ADMIN_ROUTE,
          `/admin/analytics/?tab=details`,
        ),

        // Settings route tests - inheritance and parameter handling
        settings_route_matches_admin_root: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin`,
        ),
        settings_root_without_slash: match(ADMIN_SETTINGS_ROUTE, `/admin`),
        settings_root_with_slash: match(ADMIN_SETTINGS_ROUTE, `/admin/`),
        settings_with_general_tab: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/settings/general`,
        ),
        settings_with_security_tab: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/settings/security`,
        ),
        settings_with_literal_settings_path: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/settings`,
        ),
        settings_with_wrong_search_param: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin?wrongParam=value`,
        ),
        settings_should_not_match_analytics_url: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/analytics`,
        ),
        settings_should_not_match_users_url: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/users`,
        ),
        settings_with_different_section: match(
          ADMIN_SETTINGS_ROUTE,
          `/admin/different`,
        ),

        // Analytics route tests - inheritance and search parameters
        analytics_with_overview_tab: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/analytics`,
        ),
        analytics_with_performance_tab: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/analytics?tab=performance`,
        ),
        analytics_root_without_slash: match(ADMIN_ANALYTICS_ROUTE, `/admin`),
        analytics_root_with_slash: match(ADMIN_ANALYTICS_ROUTE, `/admin/`),
        analytics_with_literal_analytics_path: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/analytics`,
        ),
        analytics_with_wrong_search_param: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin?wrongParam=value`,
        ),
        analytics_should_not_match_settings_url: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/settings`,
        ),
        analytics_should_not_match_users_url: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/users`,
        ),
        analytics_with_different_section: match(
          ADMIN_ANALYTICS_ROUTE,
          `/admin/different`,
        ),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
