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
    const sectionSignal = stateSignal("settings", { id: "section" });
    const tabSignal = stateSignal("general", { id: "settings_tab" });
    const analyticsTabSignal = stateSignal("overview", { id: "analytics_tab" });

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
      // Test deepest URL generation - should find child routes when possible
      admin_no_params_should_find_settings_with_general_tab:
        buildUrl(ADMIN_ROUTE),
      admin_explicit_settings: buildUrl(ADMIN_ROUTE, {
        section: "settings",
      }),
      admin_explicit_users: buildUrl(ADMIN_ROUTE, {
        section: "users",
      }),

      // Settings route URL building - should use deepest route
      settings_should_include_general_tab: buildUrl(ADMIN_SETTINGS_ROUTE),
      settings_with_security_tab: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "security",
      }),
      // Test that providing section param doesn't interfere
      settings_with_explicit_section_and_tab: buildUrl(ADMIN_SETTINGS_ROUTE, {
        section: "toto",
        tab: "advanced",
      }),
      settings_with_extra_params: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "general",
        filter: "active",
      }),

      // Analytics route URL building
      analytics_should_include_overview_tab: buildUrl(ADMIN_ANALYTICS_ROUTE),
      analytics_with_performance_tab: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "performance",
      }),
      analytics_with_explicit_section: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        section: "toto",
        tab: "performance",
      }),
      analytics_with_extra_params: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "details",
        dateRange: "7d",
      }),
    };
  });

  test("deepest url generation with local storage mocking", () => {
    // Store original state for cleanup
    const originalScenarios = [];

    // Scenario 1: section=settings, tab=general (both defaults)
    clearAllRoutes();
    const sectionSignal1 = stateSignal("settings", { id: "section_1" });
    const tabSignal1 = stateSignal("general", { id: "settings_tab_1" });

    const ADMIN_ROUTE_1 = registerRoute(`/admin/:section=${sectionSignal1}/`);
    const ADMIN_SETTINGS_ROUTE_1 = registerRoute(
      `/admin/settings/:tab=${tabSignal1}`,
    );

    originalScenarios.push({
      name: "both_at_defaults",
      section_value: "settings",
      tab_value: "general",
      admin_url: ADMIN_ROUTE_1.buildUrl({}),
      settings_url: ADMIN_SETTINGS_ROUTE_1.buildUrl({}),
    });

    // Scenario 2: section=settings, tab=security (section default, tab non-default)
    clearAllRoutes();
    const sectionSignal2 = stateSignal("settings", { id: "section_2" });
    const tabSignal2 = stateSignal("security", { id: "settings_tab_2" });

    const ADMIN_ROUTE_2 = registerRoute(`/admin/:section=${sectionSignal2}/`);
    const ADMIN_SETTINGS_ROUTE_2 = registerRoute(
      `/admin/settings/:tab=${tabSignal2}`,
    );

    originalScenarios.push({
      name: "section_default_tab_non_default",
      section_value: "settings",
      tab_value: "security",
      admin_url: ADMIN_ROUTE_2.buildUrl({}),
      settings_url: ADMIN_SETTINGS_ROUTE_2.buildUrl({}),
    });

    // Scenario 3: section=users, tab=general (section non-default, tab default)
    clearAllRoutes();
    const sectionSignal3 = stateSignal("users", { id: "section_3" });
    const tabSignal3 = stateSignal("general", { id: "settings_tab_3" });

    const ADMIN_ROUTE_3 = registerRoute(`/admin/:section=${sectionSignal3}/`);
    const ADMIN_SETTINGS_ROUTE_3 = registerRoute(
      `/admin/settings/:tab=${tabSignal3}`,
    );

    originalScenarios.push({
      name: "section_non_default_tab_default",
      section_value: "users",
      tab_value: "general",
      admin_url: ADMIN_ROUTE_3.buildUrl({}),
      settings_url: ADMIN_SETTINGS_ROUTE_3.buildUrl({}),
    });

    return {
      scenarios: originalScenarios,
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
