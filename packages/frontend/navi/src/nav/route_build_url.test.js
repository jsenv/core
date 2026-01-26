import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes, updateRoutes } from "./route.js";
import { rawUrlPart, setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic url building", () => {
    try {
      const { HOME_ROUTE, USER_ROUTE, USER_POSTS_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        USER_ROUTE: "/users/:id",
        USER_POSTS_ROUTE: "/users/:id/posts/:postId",
      });

      return {
        home_route: HOME_ROUTE.buildUrl(),
        simple_param: USER_ROUTE.buildUrl({ id: "123" }),
        multiple_params: USER_POSTS_ROUTE.buildUrl({
          id: "123",
          postId: "abc",
        }),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with nested routes inheritance", () => {
    try {
      const sectionSignal = stateSignal("settings", { id: "section" });
      const tabSignal = stateSignal("general", { id: "settings_tab" });
      const analyticsTabSignal = stateSignal("overview", {
        id: "analytics_tab",
      });
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE, ADMIN_ANALYTICS_ROUTE } =
        setupRoutes({
          ROOT: "/",
          ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
          ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
          ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
        });

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
      clearAllRoutes();
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

    try {
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

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
      delete globalThis.window;
    }
  });

  test("parent url updates when child signals change", () => {
    try {
      const sectionSignal = stateSignal("settings", {
        id: "section_reactive",
      });
      const tabSignal = stateSignal("general", {
        id: "settings_tab_reactive",
      });
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("explicit params should override signal values", () => {
    try {
      const sectionSignal = stateSignal("settings", {
        id: "param_override_section",
      });
      const tabSignal = stateSignal("general", { id: "param_override_tab" });

      tabSignal.value = "advanced";

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("root route should not use deepest url generation", () => {
    try {
      const sectionSignal = stateSignal("settings");
      const tabSignal = stateSignal("general");

      sectionSignal.value = "users";
      tabSignal.value = "advanced";

      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      return {
        root_url: ROOT_ROUTE.buildUrl({}),
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url generation with search parameters", () => {
    try {
      const tabSignal = stateSignal("overview", { id: "debug_tab" });
      tabSignal.value = "details";

      const { ADMIN_ROUTE, ANALYTICS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section/`,
        ANALYTICS_ROUTE: `/admin/analytics?tab=${tabSignal}`,
      });

      return {
        admin_with_analytics_section: ADMIN_ROUTE.buildUrl({
          section: "analytics",
        }),
        admin_with_no_params: ADMIN_ROUTE.buildUrl({}),
        analytics_direct: ANALYTICS_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
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

    try {
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

      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_ANALYTICS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });

      return {
        admin_route_url: ADMIN_ROUTE.buildUrl({}),
        analytics_route_url: ADMIN_ANALYTICS_ROUTE.buildUrl({}),
        root_route_url: ROOT_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      delete globalThis.window;
    }
  });

  test("url building with extra params", () => {
    try {
      const sectionSignal = stateSignal("general", { id: "extra_params_tab" });
      const { ADMIN_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with geographic coordinates (city map scenario)", () => {
    try {
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

      const { MAP_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        SELECT_CITY_ROUTE: "/select_city",
        MAP_ROUTE: `/map?city=${citySignal}&lon=${longitudeSignal}&lat=${latitudeSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("complex url building with multiple signals", () => {
    try {
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

      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_TOTO_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zone=${zoneIdSignal}&style=${mapboxStyleSignal}&lon=${mapboxLongitudeSignal}&lat=${mapboxLatitudeSignal}&zoom=${mapboxZoomSignal}&sidebar=${mapSidebarOpenedSignal}`,
          MAP_ISOCHRONE_ROUTE: "/map/isochrone/",
          MAP_ISOCHRONE_TOTO_ROUTE: `/map/isochrone/toto/?time=${isochromeWalkTimeSignal}`,
        });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("buildMostPreciseUrl should find child signal values even with provided params", () => {
    try {
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

      const { ISOCHRONE_ROUTE } = setupRoutes({
        ISOCHRONE_ROUTE: `/map/isochrone/:tab?`,
        ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkEnabledSignal}&walk_minute=${walkMinuteSignal}`,
      });

      return {
        url_with_walk_true: ISOCHRONE_ROUTE.buildUrl({ walk: true }),
        url_without_params: ISOCHRONE_ROUTE.buildUrl(),
        url_with_tab_and_walk: ISOCHRONE_ROUTE.buildUrl({
          tab: "settings",
          walk: true,
        }),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("settings route should return /admin when all params are defaults", () => {
    try {
      const sectionSignal = stateSignal("settings");
      const settingsTabSignal = stateSignal("general");
      const analyticsTabSignal = stateSignal("overview");

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${settingsTabSignal}`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });

      updateRoutes(`${baseUrl}/admin/settings/advanced`);

      return {
        settings_url_with_default_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general",
        }),
        settings_url_no_params: ADMIN_SETTINGS_ROUTE.buildUrl(),
        admin_url: ADMIN_ROUTE.buildUrl(),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("search param order should be predictable", () => {
    try {
      const aSignal = stateSignal("a-value", { id: "a" });
      const bSignal = stateSignal("b-value", { id: "b" });
      const cSignal = stateSignal("c-value", { id: "c" });

      const { ROUTE } = setupRoutes({
        ROUTE: `/test?a=${aSignal}&b=${bSignal}&c=${cSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("search param order with complex patterns", () => {
    try {
      const filterSignal = stateSignal("active", { id: "filter" });
      const sortSignal = stateSignal("name", { id: "sort" });
      const pageSignal = stateSignal(1, { id: "page", type: "number" });

      const { SEARCH_ROUTE, SEARCH_RESULTS_ROUTE } = setupRoutes({
        SEARCH_ROUTE: `/search?filter=${filterSignal}&sort=${sortSignal}`,
        SEARCH_RESULTS_ROUTE: `/search/results?page=${pageSignal}&limit=20`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("map isochrone url generation from map with custom zone", () => {
    try {
      const zoneSignal = stateSignal(undefined);
      const isochroneTabSignal = stateSignal("compare");
      const walkSignal = stateSignal(false);
      const panelSignal = stateSignal(undefined);
      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_WALK_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zone=${zoneSignal}`,
          MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}/`,
          MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/`,
          MAP_ISOCHRONE_WALK_ROUTE: `/map/isochrone/compare/?walk=${walkSignal}`,
        });
      updateRoutes(`${baseUrl}/map?zone=something`);
      return {
        map_url: MAP_ROUTE.buildUrl(),
        isochrone_url: MAP_ISOCHRONE_ROUTE.buildUrl(),
        isochrone_compare_walk_url: MAP_ISOCHRONE_WALK_ROUTE.buildUrl(),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("hierarchical search param order should respect ancestor patterns", () => {
    try {
      const zoneSignal = stateSignal("zone-123", { id: "zone" });
      const walkSignal = stateSignal(false, { id: "walk", type: "boolean" });
      const timeSignal = stateSignal(30, { id: "time", type: "number" });
      const modeSignal = stateSignal("driving", { id: "mode" });

      const { MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_WALK_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zone=${zoneSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/?walk=${walkSignal}&time=${timeSignal}`,
        MAP_ISOCHRONE_WALK_ROUTE: `/map/isochrone/walk?mode=${modeSignal}`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parent route should use child route when child has non-default signal", () => {
    try {
      // Set up the scenario: zone selection page -> map route building
      const zoneSignal = stateSignal(undefined);
      const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
      mapPanelSignal.value = "isochrone";
      zoneSignal.value = "paris";
      const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
        ZONE_SELECTION_ROUTE: "/zone_selection",
        MAP_ROUTE: `/map/?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone`,
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parent route should handle undefined signals correctly", () => {
    try {
      const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
      const isochroneTabSignal = stateSignal("compare");

      mapPanelSignal.value = "isochrone";

      const { MAP_ROUTE, MAP_ISOCHRONE_COMPARE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare`,
      });

      return {
        map_url_normal: MAP_ROUTE.buildUrl(),
        map_url_panel_undefined: MAP_ROUTE.buildUrl({
          panel: undefined,
        }),
        isochrone_compare_url: MAP_ISOCHRONE_COMPARE_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("literal segments should prevent descendant optimization", () => {
    try {
      const fileSignal = stateSignal("readme.txt", { id: "file" });

      const { DIR_ROUTE, FILE_ROUTE } = setupRoutes({
        DIR_ROUTE: `/dir/`,
        FILE_ROUTE: `/dir/subdir/:file=${fileSignal}`,
      });

      return {
        dir_url: DIR_ROUTE.buildUrl({}),
        file_url: FILE_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route with undefined parameter default should not optimize to children", () => {
    try {
      const partSignal = stateSignal(undefined, { id: "part" });
      const subpartSignal = stateSignal("details", { id: "subpart" });

      const { TOTO_ROUTE, TOTO_SUB_ROUTE } = setupRoutes({
        TOTO_ROUTE: `/toto/:part=${partSignal}`,
        TOTO_SUB_ROUTE: `/toto/admin/:subpart=${subpartSignal}`,
      });

      return {
        toto_url_with_undefined_default: TOTO_ROUTE.buildUrl({}),
        toto_url_explicit_undefined: TOTO_ROUTE.buildUrl({ part: undefined }),
        toto_url_with_value: TOTO_ROUTE.buildUrl({ part: "admin" }),
        toto_sub_url: TOTO_SUB_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("rawUrlPart functionality in url building", () => {
    try {
      const { FILES_ROUTE, API_ROUTE } = setupRoutes({
        FILES_ROUTE: "/files/:path",
        API_ROUTE: "/api/search",
      });

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
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
