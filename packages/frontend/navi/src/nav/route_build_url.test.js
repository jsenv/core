import { snapshotTests } from "@jsenv/snapshot";
import { stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, registerRoute, setBaseUrl } from "./route.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const testBuildUrl = (pattern, params = {}) => {
  const route = registerRoute(pattern);
  const url = route.buildUrl(params);
  clearAllRoutes();
  return url;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic url building", () => {
    return {
      home_route: testBuildUrl("/"),
      simple_param: testBuildUrl("/users/:id", { id: "123" }),
      multiple_params: testBuildUrl("/users/:id/posts/:postId", {
        id: "123",
        postId: "abc",
      }),
    };
  });

  test("url building with nested routes inheritance", () => {
    clearAllRoutes();
    const sectionSignal = stateSignal("settings");
    const tabSignal = stateSignal("general");
    const analyticsTabSignal = stateSignal("overview");

    // Register routes with inheritance setup (same as route_matching.test.js)
    registerRoute("/");
    const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = registerRoute(
      `/admin/settings/:tab=${tabSignal}`,
    );
    const ADMIN_ANALYTICS_ROUTE = registerRoute(
      `/admin/analytics/?tab=${analyticsTabSignal}`,
    );

    const buildUrl = (route, params = {}) => {
      return route.buildUrl(params);
    };

    return {
      // Admin route URL building - basic parameter building with defaults
      admin_no_params: buildUrl(ADMIN_ROUTE),
      admin_with_section_settings: buildUrl(ADMIN_ROUTE, {
        section: "settings",
      }),
      admin_with_section_users: buildUrl(ADMIN_ROUTE, {
        section: "users",
      }),

      // Settings route URL building - should handle inheritance properly
      settings_no_params: buildUrl(ADMIN_SETTINGS_ROUTE),
      settings_with_tab_general: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "general",
      }),
      settings_with_tab_security: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "security",
      }),
      // Test that providing section param doesn't interfere (should be filtered as literal)
      settings_with_section_toto_and_tab_advanced: buildUrl(
        ADMIN_SETTINGS_ROUTE,
        {
          section: "toto",
          tab: "advanced",
        },
      ),
      settings_with_extra_params: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "general",
        filter: "active",
      }),

      // Analytics route URL building - inheritance with search params
      analytics_no_params: buildUrl(ADMIN_ANALYTICS_ROUTE),
      analytics_with_tab_overview: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "overview",
      }),
      analytics_with_tab_performance: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "performance",
      }),
      // Test that providing section param doesn't interfere (should be filtered as literal)
      analytics_with_section_toto_and_tab_performance: buildUrl(
        ADMIN_ANALYTICS_ROUTE,
        {
          section: "toto",
          tab: "performance",
        },
      ),
      analytics_with_extra_params: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "details",
        dateRange: "7d",
      }),
    };
  });

  test("url building with extra params", () => {
    const tabSignal = stateSignal("general");

    return {
      // Extra params should become search parameters
      with_extra_params: testBuildUrl(`/admin/:section=${tabSignal}`, {
        section: "settings",
        filter: "active",
        page: "2",
      }),
      // Only extra params
      only_search_params: testBuildUrl("/admin", {
        tab: "users",
        sort: "name",
      }),
    };
  });
});
