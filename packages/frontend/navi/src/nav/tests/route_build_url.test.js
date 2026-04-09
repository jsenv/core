import { snapshotTests } from "@jsenv/snapshot";

import { globalSignalRegistry, stateSignal } from "../../state/state_signal.js";
import { route, setupRoutes } from "../route.js";
import { rawUrlPart, setBaseUrl } from "../route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic url building", () => {
    const HOME_ROUTE = route("/");
    const USER_ROUTE = route("/users/:id");
    const USER_POSTS_ROUTE = route("/users/:id/posts/:postId");
    const { clearRoutes } = setupRoutes([
      HOME_ROUTE,
      USER_ROUTE,
      USER_POSTS_ROUTE,
    ]);
    try {
      return {
        home_route: HOME_ROUTE.buildUrl(),
        simple_param: USER_ROUTE.buildUrl({ id: "123" }),
        multiple_params: USER_POSTS_ROUTE.buildUrl({
          id: "123",
          postId: "abc",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with nested routes inheritance", () => {
    const sectionSignal = stateSignal("settings", { id: "section" });
    const tabSignal = stateSignal("general", { id: "settings_tab" });
    const analyticsTabSignal = stateSignal("overview", {
      id: "analytics_tab",
    });
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics", {
      searchParams: { tab: analyticsTabSignal },
    });
    const { clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);
    try {
      return {
        // Test deepest URL generation
        admin_no_params: ADMIN_ROUTE.buildUrl(),
        admin_explicit_settings: ADMIN_ROUTE.buildUrl({
          section: "settings",
        }),
        admin_explicit_users: ADMIN_ROUTE.buildUrl({
          section: "users",
        }),

        // Settings route URL building
        settings_no_params: ADMIN_SETTINGS_ROUTE.buildUrl(),
        settings_with_security_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security",
        }),
        settings_with_section_override: ADMIN_SETTINGS_ROUTE.buildUrl({
          section: "toto",
          tab: "advanced",
        }),
        settings_with_extra_params: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general",
          filter: "active",
        }),

        // Analytics route URL building
        analytics_no_params: ADMIN_ANALYTICS_ROUTE.buildUrl(),
        analytics_with_performance_tab: ADMIN_ANALYTICS_ROUTE.buildUrl({
          tab: "performance",
        }),
        analytics_with_extra_params: ADMIN_ANALYTICS_ROUTE.buildUrl({
          tab: "details",
          dateRange: "7d",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with localStorage persistence", () => {
    // Mock window.localStorage
    const localStorageMock = {
      storage: new Map(),
      getItem(key) {
        return this.storage.get(key) || null;
      },
      setItem(key, value) {
        this.storage.set(key, String(value));
      },
      removeItem(key) {
        this.storage.delete(key);
      },
      clear() {
        this.storage.clear();
      },
    };

    if (!globalThis.window) {
      globalThis.window = {};
    }
    globalThis.window.localStorage = localStorageMock;
    localStorageMock.setItem("section_ls", "settings");
    localStorageMock.setItem("settings_tab_ls", "general");

    const sectionSignal = stateSignal("settings", {
      id: "section_ls",
      persists: true,
      type: "string",
    });
    const tabSignal = stateSignal("general", {
      id: "settings_tab_ls",
      persists: true,
      type: "string",
    });
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const { clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
    ]);
    try {
      const bothDefaults = {
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change to non-defaults
      sectionSignal.value = "users";
      tabSignal.value = "security";

      const bothNonDefaults = {
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Mixed scenario: section=default, tab=non-default
      sectionSignal.value = "settings";
      tabSignal.value = "security";

      const mixed = {
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      return {
        both_defaults: bothDefaults,
        both_non_defaults: bothNonDefaults,
        section_default_tab_non_default: mixed,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
      delete globalThis.window;
    }
  });

  test("parent url updates when child signals change", () => {
    const sectionSignal = stateSignal("settings", {
      id: "section_reactive",
    });
    const tabSignal = stateSignal("general", {
      id: "settings_tab_reactive",
    });
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const { clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
    ]);
    try {
      const initialUrls = {
        admin_initial: ADMIN_ROUTE.buildUrl({}),
        settings_initial: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change child route signal to non-default
      tabSignal.value = "security";

      const afterTabChange = {
        admin_after_tab_change: ADMIN_ROUTE.buildUrl({}),
        settings_after_tab_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change parent route signal to non-default
      sectionSignal.value = "users";

      const afterSectionChange = {
        admin_after_section_change: ADMIN_ROUTE.buildUrl({}),
        settings_after_section_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      return {
        initialUrls,
        afterTabChange,
        afterSectionChange,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("explicit params should override signal values", () => {
    const sectionSignal = stateSignal("settings", {
      id: "param_override_section",
    });
    const tabSignal = stateSignal("general", { id: "param_override_tab" });
    tabSignal.value = "advanced";
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const { clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
    ]);
    try {
      return {
        explicit_general_override: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general", // Should override signal "advanced" → "/admin"
        }),
        using_signal_value: ADMIN_SETTINGS_ROUTE.buildUrl({}),
        explicit_security_override: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security",
        }),
        section_default: ADMIN_ROUTE.buildUrl({
          section: "settings",
        }),
        section_non_default: ADMIN_ROUTE.buildUrl({
          section: "users",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("root route should not use deepest url generation", () => {
    const sectionSignal = stateSignal("settings");
    const tabSignal = stateSignal("general");
    sectionSignal.value = "users";
    tabSignal.value = "advanced";
    const ROOT_ROUTE = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
    const { clearRoutes } = setupRoutes([
      ROOT_ROUTE,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
    ]);
    try {
      return {
        root_url: ROOT_ROUTE.buildUrl({}),
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url generation with search parameters", () => {
    const tabSignal = stateSignal("overview", { id: "debug_tab" });
    tabSignal.value = "details";
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section/`);
    const ANALYTICS_ROUTE = route("/admin/analytics", {
      searchParams: { tab: tabSignal },
    });
    const { clearRoutes } = setupRoutes([ROOT, ADMIN_ROUTE, ANALYTICS_ROUTE]);
    try {
      return {
        admin_with_analytics_section: ADMIN_ROUTE.buildUrl({
          section: "analytics",
        }),
        admin_with_no_params: ADMIN_ROUTE.buildUrl({}),
        analytics_direct: ANALYTICS_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url generation with localStorage persistence", () => {
    const localStorageMock = {
      storage: new Map(),
      getItem(key) {
        return this.storage.get(key) || null;
      },
      setItem(key, value) {
        this.storage.set(key, String(value));
      },
      removeItem(key) {
        this.storage.delete(key);
      },
      clear() {
        this.storage.clear();
      },
    };
    globalThis.window = {
      localStorage: localStorageMock,
    };
    localStorageMock.setItem("section_deepest", "analytics");
    localStorageMock.setItem("analytics_tab_deepest", "details");

    const sectionSignal = stateSignal("settings", {
      id: "section_deepest",
      persists: true,
      type: "string",
    });
    const analyticsTabSignal = stateSignal("overview", {
      id: "analytics_tab_deepest",
      persists: true,
      type: "string",
    });
    const ROOT_ROUTE = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics", {
      searchParams: { tab: analyticsTabSignal },
    });
    const { clearRoutes } = setupRoutes([
      ROOT_ROUTE,
      ADMIN_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);
    try {
      return {
        admin_route_url: ADMIN_ROUTE.buildUrl({}),
        analytics_route_url: ADMIN_ANALYTICS_ROUTE.buildUrl({}),
        root_route_url: ROOT_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
      delete globalThis.window;
    }
  });

  test("url building with extra params", () => {
    const sectionSignal = stateSignal("general", { id: "extra_params_tab" });
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}`);
    const { clearRoutes } = setupRoutes([ROOT, ADMIN_ROUTE]);
    try {
      return {
        // Extra params should become search parameters
        with_extra_params: ADMIN_ROUTE.buildUrl({
          section: "settings",
          filter: "active",
          page: "2",
        }),
        // extra params (no session given)
        _search_params: ADMIN_ROUTE.buildUrl({
          tab: "users",
          sort: "name",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with geographic coordinates (city map scenario)", () => {
    const citySignal = stateSignal("Paris", {
      id: "city",
      oneOf: ["Paris", "London", "Tokyo", "New York", "Sydney"],
    });
    const longitudeSignal = stateSignal(2.3522, {
      id: "longitude",
      type: "number",
    });
    const latitudeSignal = stateSignal(48.8566, {
      id: "latitude",
      type: "number",
    });
    const HOME_ROUTE = route("/");
    const SELECT_CITY_ROUTE = route("/select_city");
    const MAP_ROUTE = route("/map", {
      searchParams: {
        city: citySignal,
        lon: longitudeSignal,
        lat: latitudeSignal,
      },
    });
    const { clearRoutes } = setupRoutes([
      HOME_ROUTE,
      SELECT_CITY_ROUTE,
      MAP_ROUTE,
    ]);
    try {
      return {
        // Default state with all signal values
        map_with_paris_coordinates: MAP_ROUTE.buildUrl(),

        // Override city but keep coordinates from signals
        map_with_explicit_city: MAP_ROUTE.buildUrl({ city: "London" }),

        // Override all parameters
        map_with_all_explicit_params: MAP_ROUTE.buildUrl({
          city: "Tokyo",
          lon: 139.6917,
          lat: 35.6895,
        }),

        // Override coordinates but keep city from signal
        map_with_explicit_coordinates: MAP_ROUTE.buildUrl({
          lon: -0.1276,
          lat: 51.5074,
        }),

        // Add extra search params
        map_with_extra_params: MAP_ROUTE.buildUrl({
          city: "Sydney",
          zoom: 10,
          layer: "satellite",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("complex url building with multiple signals", () => {
    const zoneIdSignal = stateSignal("zone-123", {
      id: "zoneId",
      type: "string",
    });
    const mapboxStyleSignal = stateSignal("streets-v11", {
      id: "mapboxStyle",
      type: "string",
    });
    const mapboxLongitudeSignal = stateSignal(2.3522, {
      id: "mapboxLongitude",
      type: "float",
    });
    const mapboxLatitudeSignal = stateSignal(48.8566, {
      id: "mapboxLatitude",
      type: "float",
    });
    const mapboxZoomSignal = stateSignal(12, {
      id: "mapboxZoom",
      type: "number",
    });
    const mapSidebarOpenedSignal = stateSignal(true, {
      id: "mapSidebarOpened",
      type: "boolean",
    });
    const isochromeWalkTimeSignal = stateSignal(20, {
      id: "isochroneWalk",
      type: "number",
    });
    const MAP_ROUTE = route("/map/", {
      searchParams: {
        zone: zoneIdSignal,
        style: mapboxStyleSignal,
        lon: mapboxLongitudeSignal,
        lat: mapboxLatitudeSignal,
        zoom: mapboxZoomSignal,
        sidebar: mapSidebarOpenedSignal,
      },
    });
    const MAP_ISOCHRONE_ROUTE = route("/map/isochrone/");
    const MAP_ISOCHRONE_TOTO_ROUTE = route("/map/isochrone/toto/", {
      searchParams: { time: isochromeWalkTimeSignal },
    });
    const { clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_TOTO_ROUTE,
    ]);
    try {
      // Step 1: Generate URL with all defaults (no params passed)
      const urlWithDefaults = MAP_ROUTE.buildUrl();
      // Step 2: Change zoom signal to non-default value
      mapboxZoomSignal.value = 15;
      // Step 3: Generate URL again without params to see if changed zoom appears
      const urlAfterZoomChange = MAP_ROUTE.buildUrl();
      // Step 4: Override signal value with undefined to ignore signal
      const urlWithZoomOverridden = MAP_ROUTE.buildUrl({ zoom: undefined });
      const isochroneUrl = MAP_ISOCHRONE_ROUTE.buildUrl();
      const isochroneTimeWalkRoute = MAP_ISOCHRONE_TOTO_ROUTE.buildUrl();

      isochromeWalkTimeSignal.value = 40;
      const isochroneTimeWalkRouteAfterChange =
        MAP_ISOCHRONE_TOTO_ROUTE.buildUrl();

      return {
        map_url_defaults: urlWithDefaults,
        map_url_with_zoom: urlAfterZoomChange,
        map_url_with_zoom_overridden: urlWithZoomOverridden,
        map_isochrone_url_with_zoom: isochroneUrl,
        map_isochrone_toto_url_with_zoom: isochroneTimeWalkRoute,
        map_isochrone_toto_url_after_change: isochroneTimeWalkRouteAfterChange,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("buildMostPreciseUrl should find child signal values even with provided params", () => {
    const walkEnabledSignal = stateSignal(false, {
      id: "walkEnabled",
      type: "boolean",
    });
    const walkMinuteSignal = stateSignal(30, {
      id: "walkMinute",
      type: "number",
    });
    walkEnabledSignal.value = false;
    walkMinuteSignal.value = 40;
    const ISOCHRONE_ROUTE = route(`/map/isochrone/:tab?`);
    const ISOCHRONE_COMPARE_ROUTE = route("/map/isochrone/compare", {
      searchParams: { walk: walkEnabledSignal, walk_minute: walkMinuteSignal },
    });
    const { clearRoutes } = setupRoutes([
      ISOCHRONE_ROUTE,
      ISOCHRONE_COMPARE_ROUTE,
    ]);
    try {
      const url_without_params = ISOCHRONE_ROUTE.buildUrl();
      const url_with_walk = ISOCHRONE_ROUTE.buildUrl({ walk: true });
      const url_with_walk_and_tab = ISOCHRONE_ROUTE.buildUrl({
        tab: "settings",
        walk: true,
      });
      return {
        url_without_params,
        url_with_walk,
        url_with_walk_and_tab,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("settings route should return /admin when all params are defaults", () => {
    const sectionSignal = stateSignal("settings");
    const settingsTabSignal = stateSignal("general");
    const analyticsTabSignal = stateSignal("overview");
    const ROOT = route("/");
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(
      `/admin/settings/:tab=${settingsTabSignal}`,
    );
    const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics", {
      searchParams: { tab: analyticsTabSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      ROOT,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/admin/settings/advanced`);

      return {
        settings_url_with_default_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general",
        }),
        settings_url_no_params: ADMIN_SETTINGS_ROUTE.buildUrl(),
        admin_url: ADMIN_ROUTE.buildUrl(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("search param order should be predictable", () => {
    const aSignal = stateSignal("a-value", { id: "a" });
    const bSignal = stateSignal("b-value", { id: "b" });
    const cSignal = stateSignal("c-value", { id: "c" });
    const ROUTE = route("/test", {
      searchParams: { a: aSignal, b: bSignal, c: cSignal },
    });
    const { clearRoutes } = setupRoutes([ROUTE]);
    try {
      return {
        no_provided_params: ROUTE.buildUrl(),
        provided_same_order: ROUTE.buildUrl({
          a: "new-a",
          b: "new-b",
          c: "new-c",
        }),
        provided_different_order: ROUTE.buildUrl({
          c: "new-c",
          a: "new-a",
          b: "new-b",
        }),
        partial_provided: ROUTE.buildUrl({ b: "new-b" }),
        extra_params: ROUTE.buildUrl({
          d: "extra-d",
          b: "new-b",
          e: "extra-e",
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("search param order with complex patterns", () => {
    const filterSignal = stateSignal("active", { id: "filter" });
    const sortSignal = stateSignal("name", { id: "sort" });
    const pageSignal = stateSignal(1, { id: "page", type: "number" });
    const SEARCH_ROUTE = route("/search", {
      searchParams: { filter: filterSignal, sort: sortSignal },
    });
    const SEARCH_RESULTS_ROUTE = route("/search/results", {
      searchParams: { page: pageSignal },
    });
    const { clearRoutes } = setupRoutes([SEARCH_ROUTE, SEARCH_RESULTS_ROUTE]);
    try {
      return {
        search_no_params: SEARCH_ROUTE.buildUrl(),
        search_with_params: SEARCH_ROUTE.buildUrl({ sort: "date" }),
        results_no_params: SEARCH_RESULTS_ROUTE.buildUrl(),
        results_with_params: SEARCH_RESULTS_ROUTE.buildUrl({
          page: 2,
          limit: 50,
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("map isochrone url generation from map with custom zone", () => {
    const zoneSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const walkSignal = stateSignal(false);
    const panelSignal = stateSignal(undefined);
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${panelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
    );
    const MAP_ISOCHRONE_WALK_ROUTE = route("/map/isochrone/compare/", {
      searchParams: { walk: walkSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_WALK_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/map?zone=something`);
      return {
        map_url: MAP_ROUTE.buildUrl(),
        isochrone_url: MAP_ISOCHRONE_ROUTE.buildUrl(),
        isochrone_compare_walk_url: MAP_ISOCHRONE_WALK_ROUTE.buildUrl(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("default tab url when on second tab nested", () => {
    const zoneSignal = stateSignal(undefined);
    const panelSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const isochroneWalkSignal = stateSignal(false);
    const isochroneLongitudeSignal = stateSignal(undefined);
    isochroneLongitudeSignal.value = 2;
    const isochroneTimeModeSignal = stateSignal("walk");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${panelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
      { searchParams: { iso_lon: isochroneLongitudeSignal } },
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route("/map/isochrone/compare", {
      searchParams: { walk: isochroneWalkSignal },
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
      updateRoutes(`${baseUrl}/map/isochrone/time?iso_lon=2`);
      return {
        isochrone_compare_url: MAP_ISOCHRONE_COMPARE_ROUTE.buildUrl(),
        isochrone_time_url: MAP_ISOCHRONE_TIME_ROUTE.buildUrl(),
        isochrone_time_walk_url: MAP_ISOCHRONE_TIME_WALK_ROUTE.buildUrl(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("hierarchical search param order should respect ancestor patterns", () => {
    const zoneSignal = stateSignal("zone-123", { id: "zone" });
    const walkSignal = stateSignal(false, { id: "walk", type: "boolean" });
    const timeSignal = stateSignal(30, { id: "time", type: "number" });
    const modeSignal = stateSignal("driving", { id: "mode" });
    const MAP_ROUTE = route("/map", { searchParams: { zone: zoneSignal } });
    const MAP_ISOCHRONE_ROUTE = route("/map/isochrone/", {
      searchParams: { walk: walkSignal, time: timeSignal },
    });
    const MAP_ISOCHRONE_WALK_ROUTE = route("/map/isochrone/walk", {
      searchParams: { mode: modeSignal },
    });
    const { clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_WALK_ROUTE,
    ]);
    try {
      return {
        child_with_params: MAP_ISOCHRONE_ROUTE.buildUrl({
          zone: "custom-zone",
          walk: true,
          time: 45,
        }),
        grandchild_with_params: MAP_ISOCHRONE_WALK_ROUTE.buildUrl({
          zone: "another-zone",
          walk: true,
          mode: "cycling",
        }),
        partial_params: MAP_ISOCHRONE_ROUTE.buildUrl({
          zone: "partial-zone",
          walk: true,
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parent route should use child route when child has non-default signal", () => {
    // Set up the scenario: zone selection page -> map route building
    const zoneSignal = stateSignal(undefined);
    const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
    mapPanelSignal.value = "isochrone";
    zoneSignal.value = "paris";
    const ZONE_SELECTION_ROUTE = route("/zone_selection");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(`/map/isochrone`);
    const { updateRoutes, clearRoutes } = setupRoutes([
      ZONE_SELECTION_ROUTE,
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
    ]);
    try {
      // Simulate being on zone selection page
      updateRoutes(`${baseUrl}/zone_selection`);

      return {
        map_route_url: MAP_ROUTE.buildUrl(),
        map_url_panel_explicitely_undefined: MAP_ROUTE.buildUrl({
          panel: undefined,
        }),
        isochrone_direct: MAP_ISOCHRONE_ROUTE.buildUrl(),
        panel_route_direct: MAP_PANEL_ROUTE.buildUrl(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parent route should handle undefined signals correctly", () => {
    const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
    const isochroneTabSignal = stateSignal("compare");
    mapPanelSignal.value = "isochrone";
    const MAP_ROUTE = route(`/map/`);
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route(`/map/isochrone/compare`);
    const { clearRoutes } = setupRoutes([
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
    ]);
    try {
      return {
        map_url_normal: MAP_ROUTE.buildUrl(),
        map_url_panel_undefined: MAP_ROUTE.buildUrl({
          panel: undefined,
        }),
        isochrone_compare_url: MAP_ISOCHRONE_COMPARE_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("literal segments should prevent descendant optimization", () => {
    const fileSignal = stateSignal("readme.txt", { id: "file" });
    const DIR_ROUTE = route(`/dir/`);
    const FILE_ROUTE = route(`/dir/subdir/:file=${fileSignal}`);
    const { clearRoutes } = setupRoutes([DIR_ROUTE, FILE_ROUTE]);
    try {
      return {
        dir_url: DIR_ROUTE.buildUrl({}),
        file_url: FILE_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route with undefined parameter default should not optimize to children", () => {
    const partSignal = stateSignal(undefined, { id: "part" });
    const subpartSignal = stateSignal("details", { id: "subpart" });
    const TOTO_ROUTE = route(`/toto/:part=${partSignal}`);
    const TOTO_SUB_ROUTE = route(`/toto/admin/:subpart=${subpartSignal}`);
    const { clearRoutes } = setupRoutes([TOTO_ROUTE, TOTO_SUB_ROUTE]);
    try {
      return {
        toto_url_with_undefined_default: TOTO_ROUTE.buildUrl({}),
        toto_url_explicit_undefined: TOTO_ROUTE.buildUrl({ part: undefined }),
        toto_url_with_value: TOTO_ROUTE.buildUrl({ part: "admin" }),
        toto_sub_url: TOTO_SUB_ROUTE.buildUrl({}),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("rawUrlPart functionality in url building", () => {
    const FILES_ROUTE = route("/files/:path");
    const API_ROUTE = route("/api/search");
    const { clearRoutes } = setupRoutes([FILES_ROUTE, API_ROUTE]);
    try {
      return {
        normal_path: FILES_ROUTE.buildUrl({ path: "documents/readme.txt" }),
        raw_path: FILES_ROUTE.buildUrl({
          path: rawUrlPart("documents%2Freadme.txt"),
        }),
        normal_query: API_ROUTE.buildUrl({
          q: "hello world",
          filter: "type:document",
        }),
        raw_query: API_ROUTE.buildUrl({
          q: rawUrlPart("hello+world"),
          filter: rawUrlPart("type%3Adocument"),
        }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("map url while on isochrone time", () => {
    const zoneSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const walkSignal = stateSignal(false);
    const panelSignal = stateSignal(undefined);
    const isochroneLongitudeSignal = stateSignal(undefined);
    zoneSignal.value = "london";
    panelSignal.value = "isochrone";
    isochroneTabSignal.value = "time";
    isochroneLongitudeSignal.value = 1;
    const isochroneTimeModeSignal = stateSignal("walk");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${panelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
      { searchParams: { iso_lon: isochroneLongitudeSignal } },
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
      updateRoutes(`${baseUrl}/zone_selection`);
      return {
        map_url: MAP_ROUTE.buildUrl({ zone: "paris" }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("menu url when on default tab", () => {
    const mapPanelSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const isochroneWalkSignal = stateSignal(false);
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route("/map/isochrone/compare", {
      searchParams: { walk: isochroneWalkSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/map/isochrone`);
      isochroneWalkSignal.value = true;

      return {
        map_isochrone_url: MAP_ISOCHRONE_ROUTE.url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("sub page url when custom menu and custom tab", () => {
    const zoneSignal = stateSignal(undefined);
    const mapPanelSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const isochroneLongitudeSignal = stateSignal(undefined);
    const isochroneTimeModeSignal = stateSignal("walk");
    const HOME_ROUTE = route("/");
    const MAP_ROUTE = route("/map/", { searchParams: { zone: zoneSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
      { searchParams: { iso_lon: isochroneLongitudeSignal } },
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route(`/map/isochrone/compare`);
    const MAP_ISOCHRONE_TIME_ROUTE = route(
      `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
    );
    const MAP_ISOCHRONE_TIME_WALK_ROUTE = route("/map/isochrone/time/walk");
    const MAP_ISOCHRONE_TIME_BIKE_ROUTE = route("/map/isochrone/time/bike");
    const { updateRoutes, clearRoutes } = setupRoutes([
      HOME_ROUTE,
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
      MAP_ISOCHRONE_TIME_ROUTE,
      MAP_ISOCHRONE_TIME_WALK_ROUTE,
      MAP_ISOCHRONE_TIME_BIKE_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/map/isochrone/time?zone=london&iso_lon=1`);

      return {
        map_root_url: MAP_ROUTE.buildUrl({ panel: undefined }),
        map_isochrone_time_walk_url: MAP_ISOCHRONE_TIME_WALK_ROUTE.buildUrl(),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("dynamic default ", () => {
    const zoneLonSignal = stateSignal(undefined);
    const mapLonSignal = stateSignal(zoneLonSignal, { default: -1 });
    const isoLonSignal = stateSignal(zoneLonSignal);
    const mapPanelSignal = stateSignal(undefined);
    const HOME_ROUTE = route("/");
    const MAP_ROUTE = route("/map/", { searchParams: { lon: mapLonSignal } });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_ISOCHRONE_ROUTE = route("/map/isochrone", {
      searchParams: { iso_lon: isoLonSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([
      HOME_ROUTE,
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_ISOCHRONE_ROUTE,
    ]);
    try {
      updateRoutes(`${baseUrl}/map/isochrone`);
      const getState = () => {
        return {
          signal_values: {
            zoneLon: zoneLonSignal.value,
            mapLon: mapLonSignal.value,
            isoLon: isoLonSignal.value,
          },
          map_url: MAP_ISOCHRONE_ROUTE.url,
        };
      };

      const state_at_start = getState();

      zoneLonSignal.value = 10;
      const state_after_setting_zone_lon = getState();

      // simulate setting custom map lon
      mapLonSignal.value = 15;
      const state_after_setting_custom_map_lon = getState();

      // set an isochrone custom lon
      isoLonSignal.value = 20;
      const state_after_setting_custom_iso_lon = getState();

      // reset iso lon (go back to zoneLon)
      isoLonSignal.value = undefined;
      const state_after_resetting_iso_lon = getState();

      // reset zone lon (a new zone is loading)
      zoneLonSignal.value = undefined;
      // we must also reset the map lon in that case to follow the zone lon again
      mapLonSignal.value = undefined;
      const state_after_resetting_zone_and_map_lon = getState();

      // set the new zone lon
      zoneLonSignal.value = 5;
      const state_after_setting_new_zone_lon = getState();

      return {
        state_at_start,
        state_after_setting_zone_lon,
        state_after_setting_custom_map_lon,
        state_after_setting_custom_iso_lon,
        state_after_resetting_iso_lon,
        state_after_resetting_zone_and_map_lon,
        state_after_setting_new_zone_lon,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url build", () => {
    const DASHBOARD_ROUTE = route("/dashboard");
    const DASHBOARD_SECTION_ROUTE = route("/dashboard/section");
    const { clearRoutes } = setupRoutes([
      DASHBOARD_ROUTE,
      DASHBOARD_SECTION_ROUTE,
    ]);
    try {
      return {
        dashboard_url: DASHBOARD_ROUTE.url,
        dashboard_section_Url: DASHBOARD_SECTION_ROUTE.url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("an other", () => {
    const zoneIdSignal = stateSignal(undefined, {
      type: "string",
      oneOf: [
        undefined,
        "flow",
        "traffic",
        "isochrone",
        "population",
        "job",
        "facilities",
        "overview",
      ],
    });
    const mapPanelSignal = stateSignal(undefined);
    const isochroneLonSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare", {
      oneOf: ["compare", "time"],
    });
    const isochroneTimeModeSignal = stateSignal("walk", {
      type: "string",
      oneOf: [undefined, "walk", "transit"],
    });
    const HOME_ROUTE = route("/");
    const MAP_ROUTE = route("/map/", {
      searchParams: {
        zone: zoneIdSignal,
      },
    });
    const MAP_PANEL_ROUTE = route(`/map/:panel=${mapPanelSignal}/`);
    const MAP_TRANSIT_ROUTE = route(`/map/transit`);
    const MAP_ISOCHRONE_ROUTE = route(
      `/map/isochrone/:tab=${isochroneTabSignal}/`,
      {
        searchParams: {
          iso_lon: isochroneLonSignal,
        },
      },
    );
    const MAP_ISOCHRONE_COMPARE_ROUTE = route(`/map/isochrone/compare`, {});
    const MAP_ISOCHRONE_TIME_ROUTE = route(
      `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
    );
    const MAP_ISOCHRONE_TIME_WALK_ROUTE = route("/map/isochrone/time/walk");
    const MAP_ISOCHRONE_TIME_TRANSIT_ROUTE = route(
      "/map/isochrone/time/transit",
    );

    const { updateRoutes, clearRoutes } = setupRoutes([
      HOME_ROUTE,
      MAP_ROUTE,
      MAP_PANEL_ROUTE,
      MAP_TRANSIT_ROUTE,
      MAP_ISOCHRONE_ROUTE,
      MAP_ISOCHRONE_COMPARE_ROUTE,
      MAP_ISOCHRONE_TIME_ROUTE,
      MAP_ISOCHRONE_TIME_WALK_ROUTE,
      MAP_ISOCHRONE_TIME_TRANSIT_ROUTE,
    ]);
    isochroneTabSignal.value = "time";
    try {
      updateRoutes(`${baseUrl}/map/transit?zone=london`);
      return {
        map_root_url: MAP_ROUTE.url,
        map_isochrone_url: MAP_ISOCHRONE_ROUTE.url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });
});
