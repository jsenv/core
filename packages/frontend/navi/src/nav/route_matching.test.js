import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { route, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const getMatchParams = (route) => {
  const result = route.matching ? route.params : null;
  return result;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic", () => {
    const USER_ROUTE = route("/users/:id");
    const { updateRoutes, clearRoutes } = setupRoutes([USER_ROUTE]);
    try {
      updateRoutes(`${baseUrl}/users/123`);
      const matching_url = getMatchParams(USER_ROUTE);

      updateRoutes(`${baseUrl}/admin`);
      const non_matching_url = getMatchParams(USER_ROUTE, `/admin`);

      return {
        matching_url,
        non_matching_url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("state signal", () => {
    const sectionSignal = stateSignal("settings", {
      id: "state_signal_section",
    });
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}`);
    const { updateRoutes, clearRoutes } = setupRoutes([ADMIN_ROUTE]);

    try {
      updateRoutes(`${baseUrl}/admin`);
      const matching_with_default = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/users`);
      const matching_with_param = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/different`);
      const non_matching_url = getMatchParams(ADMIN_ROUTE);
      return {
        matching_with_default,
        matching_with_param,
        non_matching_url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url defaults with nested routes", () => {
    const sectionSignal = stateSignal("settings", { id: "nested_section" });
    const tabSignal = stateSignal("general", { id: "nested_tab" });
    const analyticsTabSignal = stateSignal("overview", {
      id: "nested_analytics_tab",
    });
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics/", {
      searchParams: { tab: analyticsTabSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);

    try {
      // Admin route tests - basic parameter matching with defaults
      updateRoutes(`${baseUrl}/admin`);
      const admin_root_matches_section_default = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/`);
      const admin_root_with_slash = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings`);
      const admin_on_settings = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings/`);
      const admin_on_settings_trailing_slash = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings/advanced`);
      const admin_on_settings_tab = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics`);
      const admin_on_analytics = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics?tab=details`);
      const admin_on_analytics_tab = getMatchParams(ADMIN_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics/?tab=details`);
      const admin_on_analytics_trailing_slash_tab = getMatchParams(ADMIN_ROUTE);

      // Settings route tests - inheritance and parameter handling
      updateRoutes(`${baseUrl}/admin`);
      const settings_route_matches_admin_root =
        getMatchParams(ADMIN_SETTINGS_ROUTE);
      const settings_root_without_slash = getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/`);
      const settings_root_with_slash = getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings/general`);
      const settings_with_general_tab = getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings/security`);
      const settings_with_security_tab = getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/settings`);
      const settings_with_literal_settings_path =
        getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin?wrongParam=value`);
      const settings_with_wrong_search_param =
        getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics`);
      const settings_should_not_match_analytics_url =
        getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/users`);
      const settings_should_not_match_users_url =
        getMatchParams(ADMIN_SETTINGS_ROUTE);
      updateRoutes(`${baseUrl}/admin/different`);
      const settings_with_different_section =
        getMatchParams(ADMIN_SETTINGS_ROUTE);

      // Analytics route tests - inheritance and search parameters
      updateRoutes(`${baseUrl}/admin/analytics`);
      const analytics_with_overview_tab = getMatchParams(ADMIN_ANALYTICS_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics?tab=performance`);
      const analytics_with_performance_tab = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin`);
      const analytics_root_without_slash = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin/`);
      const analytics_root_with_slash = getMatchParams(ADMIN_ANALYTICS_ROUTE);
      updateRoutes(`${baseUrl}/admin/analytics`);
      const analytics_with_literal_analytics_path = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin?wrongParam=value`);
      const analytics_with_wrong_search_param = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin/settings`);
      const analytics_should_not_match_settings_url = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin/users`);
      const analytics_should_not_match_users_url = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );
      updateRoutes(`${baseUrl}/admin/different`);
      const analytics_with_different_section = getMatchParams(
        ADMIN_ANALYTICS_ROUTE,
      );

      return {
        admin_root_matches_section_default,
        admin_root_with_slash,
        admin_on_settings,
        admin_on_settings_trailing_slash,
        admin_on_settings_tab,
        admin_on_analytics,
        admin_on_analytics_tab,
        admin_on_analytics_trailing_slash_tab,
        settings_route_matches_admin_root,
        settings_root_without_slash,
        settings_root_with_slash,
        settings_with_general_tab,
        settings_with_security_tab,
        settings_with_literal_settings_path,
        settings_with_wrong_search_param,
        settings_should_not_match_analytics_url,
        settings_should_not_match_users_url,
        settings_with_different_section,
        analytics_with_overview_tab,
        analytics_with_performance_tab,
        analytics_root_without_slash,
        analytics_root_with_slash,
        analytics_with_literal_analytics_path,
        analytics_with_wrong_search_param,
        analytics_should_not_match_settings_url,
        analytics_should_not_match_users_url,
        analytics_with_different_section,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("matchesParams with trailing slash behavior", () => {
    const sectionSignal = stateSignal("settings", {
      id: "matches_params_section",
    });
    const tabSignal = stateSignal("overview", {
      id: "matches_params_tab",
    });
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics/", {
      searchParams: { tab: tabSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      ADMIN_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);

    try {
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
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("complex url matching with multiple signals", () => {
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
    const MAP_ROUTE = route("/map/", {
      searchParams: {
        zone: zoneIdSignal,
        style: mapboxStyleSignal,
        zoom: mapboxZoomSignal,
      },
    });
    const MAP_ISOCHRONE_ROUTE = route("/map/isochrone");
    const { updateRoutes, clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_ISOCHRONE_ROUTE,
    ]);

    try {
      updateRoutes(`${baseUrl}/map`);
      const map_without_params = getMatchParams(MAP_ROUTE);
      updateRoutes(`${baseUrl}/map?zoom=12`);
      const map_with_default_zoom = getMatchParams(MAP_ROUTE);
      updateRoutes(`${baseUrl}/map?zoom=15`);
      const map_with_zoom_15 = getMatchParams(MAP_ROUTE);
      updateRoutes(`${baseUrl}/map?zoom=8&style=satellite`);
      const map_with_zoom_and_style = getMatchParams(MAP_ROUTE);
      updateRoutes(`${baseUrl}/map/isochrone`);
      const isochrone_without_params = getMatchParams(MAP_ISOCHRONE_ROUTE);
      updateRoutes(`${baseUrl}/map/isochrone?zoom=15`);
      const isochrone_with_zoom_15 = getMatchParams(MAP_ISOCHRONE_ROUTE);
      return {
        map_without_params,
        map_with_default_zoom,
        map_with_zoom_15,
        map_with_zoom_and_style,
        isochrone_without_params,
        isochrone_with_zoom_15,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("map isochrone tab matching", () => {
    const zoneSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const walkSignal = stateSignal(false);
    const panelSignal = stateSignal(undefined);
    zoneSignal.value = "london";
    panelSignal.value = "isochrone";
    isochroneTabSignal.value = "time";
    const isochroneTimeModeSignal = stateSignal("walk");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${panelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route("/map/isochrone/compare", {
      searchParams: { walk: walkSignal },
    });
    const MAP_ISOCHRONE_TIME_ROUTE = route(
      `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
    );
    const MAP_ISOCHRONE_TIME_WALK_ROUTE = route("/map/isochrone/time/walk");
    const { updateRoutes, clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
      MAP_ISOCHRONE_TIME_ROUTE,
      MAP_ISOCHRONE_TIME_WALK_ROUTE,
    ]);

    try {
      updateRoutes(`${baseUrl}/map/isochrone/time?zone=london`);
      return {
        isochrone_compare_matching: MAP_ISOCHRONE_COMPARE_ROUTE.matching,
        isochrone_time_matching: MAP_ISOCHRONE_TIME_ROUTE.matching,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("menu matching deep", () => {
    const zoneSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const walkSignal = stateSignal(false);
    const panelSignal = stateSignal(undefined);
    const isochroneTimeModeSignal = stateSignal("walk");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${panelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route("/map/isochrone/compare", {
      searchParams: { walk: walkSignal },
    });
    const MAP_ISOCHRONE_TIME_ROUTE = route(
      `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
    );
    const MAP_ISOCHRONE_TIME_WALK_ROUTE = route("/map/isochrone/time/walk");
    const MAP_ISOCHRONE_TIME_BIKE_ROUTE = route("/map/isochrone/time/bike");
    const { updateRoutes, clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
      MAP_ISOCHRONE_TIME_ROUTE,
      MAP_ISOCHRONE_TIME_WALK_ROUTE,
      MAP_ISOCHRONE_TIME_BIKE_ROUTE,
    ]);

    try {
      updateRoutes(`${baseUrl}/map/isochrone/time/bike?zone=london`);
      return {
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
        isochrone_matches_params: MAP_ISOCHRONE_ROUTE.matchesParams(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("trailing slash vs not trailing slash", () => {
    const USER_ROUTE = route("/users/:id");
    const USER_SETTINGS_ROUTE = route("/users/:id/settings");
    const { updateRoutes, clearRoutes } = setupRoutes([
      USER_ROUTE,
      USER_SETTINGS_ROUTE,
    ]);

    try {
      updateRoutes(`${baseUrl}/users/123`);
      const firstUpdate = {
        user_route_matching: USER_ROUTE.matching,
        user_settings_route_matching: USER_SETTINGS_ROUTE.matching,
      };
      updateRoutes(`${baseUrl}/users/123/settings`);
      const secondUpdate = {
        user_route_matching: USER_ROUTE.matching,
        user_settings_route_matching: USER_SETTINGS_ROUTE.matching,
      };
      return {
        firstUpdate,
        secondUpdate,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("root with trailing slash should match", () => {
    const HOME_ROUTE = route("/");
    const TABLE_ROUTE = route("/tables/:tablename");
    const { updateRoutes, clearRoutes } = setupRoutes([
      HOME_ROUTE,
      TABLE_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/tables/a`);

      const home_matching = HOME_ROUTE.matching;
      return { home_matching };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });
});
