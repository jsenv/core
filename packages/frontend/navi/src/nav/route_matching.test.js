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

  test("matchesParams with trailing slash behavior", () => {
    try {
      const sectionSignal = stateSignal("settings", {
        id: "matches_params_section",
      });
      const tabSignal = stateSignal("overview", {
        id: "matches_params_tab",
      });
      const { ADMIN_ROUTE, ADMIN_ANALYTICS_ROUTE } = setupRoutes({
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`, // Note: trailing slash
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics/?tab=${tabSignal}`,
      });

      // Set the current URL to "/admin/analytics?tab=details"
      updateRoutes(`${baseUrl}/admin/analytics?tab=details`);

      return {
        // Current route states after URL update
        admin_route_matching: ADMIN_ROUTE.matching,
        admin_route_params: ADMIN_ROUTE.params,
        analytics_route_matching: ADMIN_ANALYTICS_ROUTE.matching,
        analytics_route_params: ADMIN_ANALYTICS_ROUTE.params,

        // Test matchesParams - the main focus of this test
        // ADMIN_ROUTE should match because "/admin/:section/" with trailing slash
        // should conceptually match "/admin/analytics?tab=details"
        admin_matches_current_params: ADMIN_ROUTE.matchesParams({}),
        admin_matches_explicit_analytics: ADMIN_ROUTE.matchesParams({
          section: "analytics",
        }),

        // For comparison - analytics route matching
        analytics_matches_current_params: ADMIN_ANALYTICS_ROUTE.matchesParams(
          {},
        ),
        analytics_matches_explicit_details: ADMIN_ANALYTICS_ROUTE.matchesParams(
          { tab: "details" },
        ),

        // Edge cases
        admin_matches_different_section: ADMIN_ROUTE.matchesParams({
          section: "users",
        }),
        analytics_matches_different_tab: ADMIN_ANALYTICS_ROUTE.matchesParams({
          tab: "performance",
        }),

        // Signal values for reference
        signal_values: {
          section: sectionSignal.value,
          tab: tabSignal.value,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("complex url matching with multiple signals", () => {
    try {
      const zoneIdSignal = stateSignal("zone-123", {
        id: "zoneId",
        type: "string",
      });
      const mapboxStyleSignal = stateSignal("streets-v11", {
        id: "mapboxStyle",
        type: "string",
      });
      const mapboxZoomSignal = stateSignal(12, {
        id: "mapboxZoom",
        type: "number",
      });

      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?zone=${zoneIdSignal}&style=${mapboxStyleSignal}&zoom=${mapboxZoomSignal}`,
        MAP_ISOCHRONE_ROUTE: "/map/isochrone",
      });

      return {
        map_without_params: match(MAP_ROUTE, `/map`),
        map_with_default_zoom: match(MAP_ROUTE, `/map?zoom=12`),
        map_with_zoom_15: match(MAP_ROUTE, `/map?zoom=15`),
        map_with_zoom_and_style: match(
          MAP_ROUTE,
          `/map?zoom=8&style=satellite`,
        ),

        isochrone_without_params: match(MAP_ISOCHRONE_ROUTE, `/map/isochrone`),
        isochrone_with_zoom_15: match(
          MAP_ISOCHRONE_ROUTE,
          `/map/isochrone?zoom=15`,
        ),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("map isochrone tab matching", () => {
    try {
      const zoneSignal = stateSignal(undefined);
      const isochroneTabSignal = stateSignal("compare");
      const walkSignal = stateSignal(false);
      const panelSignal = stateSignal(undefined);
      zoneSignal.value = "london";
      panelSignal.value = "isochrone";
      isochroneTabSignal.value = "time";
      const isochroneTimeModeSignal = stateSignal("walk");
      const { MAP_ISOCHRONE_COMPARE_ROUTE, MAP_ISOCHRONE_TIME_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zone=${zoneSignal}`,
          MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}/`,
          MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/`,
          MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkSignal}`,
          MAP_ISOCHRONE_TIME_ROUTE: `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
          MAP_ISOCHRONE_TIME_WALK_ROUTE: "/map/isochrone/time/walk",
        });
      updateRoutes(`${baseUrl}/map/isochrone/time?zone=london`);
      return {
        isochrone_compare_matching: MAP_ISOCHRONE_COMPARE_ROUTE.matching,
        isochrone_time_matching: MAP_ISOCHRONE_TIME_ROUTE.matching,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("menu matching deep", () => {
    try {
      const zoneSignal = stateSignal(undefined);
      const isochroneTabSignal = stateSignal("compare");
      const walkSignal = stateSignal(false);
      const panelSignal = stateSignal(undefined);
      const isochroneTimeModeSignal = stateSignal("walk");
      const { MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkSignal}`,
        MAP_ISOCHRONE_TIME_ROUTE: `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
        MAP_ISOCHRONE_TIME_WALK_ROUTE: "/map/isochrone/time/walk",
        MAP_ISOCHRONE_TIME_BIKE_ROUTE: "/map/isochrone/time/bike",
      });
      updateRoutes(`${baseUrl}/map/isochrone/time/bike?zone=london`);
      return {
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
        isochrone_matches_params: MAP_ISOCHRONE_ROUTE.matchesParams(),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
