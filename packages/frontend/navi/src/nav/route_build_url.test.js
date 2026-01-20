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

  test("dashboard demo scenario with state signals", () => {
    // Recreate the signals from dashboard_demo.jsx
    const sectionSignal = stateSignal("settings", {
      enum: ["settings", "analytics"],
    });
    const settingsTabSignal = stateSignal("general", {
      enum: ["general", "advanced"],
    });
    const analyticsTabSignal = stateSignal("overview", {
      enum: ["overview", "details"],
    });

    return {
      // HOME_ROUTE: "/"
      home_route: testBuildUrl("/"),

      // ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`
      admin_route_default: testBuildUrl(`/admin/:section=${sectionSignal}/`),
      admin_route_explicit_settings: testBuildUrl(
        `/admin/:section=${sectionSignal}/`,
        {
          section: "settings",
        },
      ),
      admin_route_explicit_analytics: testBuildUrl(
        `/admin/:section=${sectionSignal}/`,
        {
          section: "analytics",
        },
      ),

      // ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${settingsTabSignal}`
      settings_route_default: testBuildUrl(
        `/admin/settings/:tab=${settingsTabSignal}`,
      ),
      settings_route_general: testBuildUrl(
        `/admin/settings/:tab=${settingsTabSignal}`,
        {
          tab: "general",
        },
      ),
      settings_route_advanced: testBuildUrl(
        `/admin/settings/:tab=${settingsTabSignal}`,
        {
          tab: "advanced",
        },
      ),

      // ADMIN_ANALYTICS_ROUTE: `/admin/analytics/?tab=${analyticsTabSignal}`
      analytics_route_default: testBuildUrl(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
      ),
      analytics_route_overview: testBuildUrl(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
        {
          tab: "overview",
        },
      ),
      analytics_route_details: testBuildUrl(
        `/admin/analytics/?tab=${analyticsTabSignal}`,
        {
          tab: "details",
        },
      ),
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
