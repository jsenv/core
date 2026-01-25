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
        // Test deepest URL generation - should find child routes when possible
        admin_no_params: ADMIN_ROUTE.buildUrl(),
        admin_explicit_settings: ADMIN_ROUTE.buildUrl({
          section: "settings",
        }),
        admin_explicit_users: ADMIN_ROUTE.buildUrl({
          section: "users",
        }),

        // Settings route URL building - should use deepest route
        settings_no_params: ADMIN_SETTINGS_ROUTE.buildUrl(),
        settings_with_security_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security",
        }),
        // Test that providing section param doesn't interfere
        settings_with_section_toto_and_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          section: "toto",
          tab: "advanced",
        }),
        settings_with_extra_params: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general",
          filter: "active",
        }),

        // Analytics route URL building
        analytics_should_include_overview_tab: ADMIN_ANALYTICS_ROUTE.buildUrl(),
        analytics_with_performance_tab: ADMIN_ANALYTICS_ROUTE.buildUrl({
          tab: "performance",
        }),
        analytics_with_section_toto: ADMIN_ANALYTICS_ROUTE.buildUrl({
          section: "toto",
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

  test("url building with local storage mocking", () => {
    // Mock window.localStorage (required by valueInLocalStorage)
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

    // Ensure window object exists and has localStorage
    if (!globalThis.window) {
      globalThis.window = {};
    }
    globalThis.window.localStorage = localStorageMock;

    try {
      // Set initial localStorage values
      localStorageMock.setItem("section_ls", "settings"); // default
      localStorageMock.setItem("settings_tab_ls", "general"); // default
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

      const scenario1 = {
        name: "both_at_defaults",
        localStorage_section: localStorageMock.getItem("section_ls"), // null - cleaned up because value equals default
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"), // null - cleaned up because value equals default
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change localStorage and signal values to non-defaults
      localStorageMock.setItem("section_ls", "users");
      localStorageMock.setItem("settings_tab_ls", "security");
      sectionSignal.value = "users"; // This should trigger localStorage update
      tabSignal.value = "security"; // This should trigger localStorage update

      const scenario2 = {
        name: "both_non_defaults",
        localStorage_section: localStorageMock.getItem("section_ls"),
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"),
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Test mixed scenario: section=settings (default), tab=security (non-default)
      localStorageMock.setItem("section_ls", "settings");
      localStorageMock.setItem("settings_tab_ls", "security");
      sectionSignal.value = "settings";
      tabSignal.value = "security";

      const scenario3 = {
        name: "section_default_tab_non_default",
        localStorage_section: localStorageMock.getItem("section_ls"), // null - cleaned up because value equals default
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"),
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      return {
        scenario1,
        scenario2,
        scenario3,
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

      // Capture initial URLs
      const initialUrls = {
        admin_initial: ADMIN_ROUTE.buildUrl({}),
        settings_initial: ADMIN_SETTINGS_ROUTE.buildUrl({}),
        admin_relativeUrl_initial: ADMIN_ROUTE.relativeUrl,
        settings_relativeUrl_initial: ADMIN_SETTINGS_ROUTE.relativeUrl,
      };

      // Change child route signal (tab) - this should make parent route generate deepest URL
      tabSignal.value = "security";

      const afterTabChange = {
        admin_after_tab_change: ADMIN_ROUTE.buildUrl({}),
        settings_after_tab_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
        admin_relativeUrl_after_tab: ADMIN_ROUTE.relativeUrl,
        settings_relativeUrl_after_tab: ADMIN_SETTINGS_ROUTE.relativeUrl,
        tab_signal_value: tabSignal.value,
        // Key behavior: Parent route now generates deepest URL because child has non-default value
        parent_now_uses_child_route:
          ADMIN_ROUTE.buildUrl({}) === ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change parent route signal (section) - should use parent's own parameter
      sectionSignal.value = "users";

      const afterSectionChange = {
        admin_after_section_change: ADMIN_ROUTE.buildUrl({}),
        settings_after_section_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
        admin_relativeUrl_after_section: ADMIN_ROUTE.relativeUrl,
        settings_relativeUrl_after_section: ADMIN_SETTINGS_ROUTE.relativeUrl,
        section_signal_value: sectionSignal.value,
        // Parent route uses its own non-default parameter now
        parent_uses_own_param: ADMIN_ROUTE.buildUrl({}).includes("users"),
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
      // Match dashboard_demo.jsx scenario: general is the default
      const sectionSignal = stateSignal("settings", {
        id: "param_override_section",
      });
      const tabSignal = stateSignal("general", { id: "param_override_tab" }); // "general" is default
      // Simulate real scenario: tab signal gets changed to "advanced" in localStorage/state
      tabSignal.value = "advanced"; // This simulates what happens in real app

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      return {
        // Test the exact issue: signal has "advanced" but we explicitly pass "general" (default)
        // This should result in a short URL without the tab parameter
        bug_reproduction_explicit_general: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general", // Should override signal "advanced" and be omitted as default → "/admin"
        }),

        // Test without any explicit params - should use signal value "advanced"
        using_signal_advanced: ADMIN_SETTINGS_ROUTE.buildUrl({}), // Should use "advanced" from signal

        // Test explicit non-default override
        explicit_security_override: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security", // Should override signal "advanced" with "security"
        }),

        // Test section route behavior
        section_with_default: ADMIN_ROUTE.buildUrl({
          section: "settings",
        }),
        section_with_default_and_tab_default: ADMIN_ROUTE.buildUrl({
          section: "settings",
          tab: "general",
        }),

        section_with_non_default: ADMIN_ROUTE.buildUrl({
          section: "users", // Should appear → "/admin/users/"
        }),

        // Reference values for debugging
        current_signal_values: {
          section: sectionSignal.value,
          tab: tabSignal.value,
        },
        signal_defaults: {
          section: "settings", // stateSignal first param
          tab: "general", // stateSignal first param
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("root route should not use deepest url generation", () => {
    try {
      // Set up signals with non-default values that would normally trigger deepest URL
      const sectionSignal = stateSignal("settings");
      const tabSignal = stateSignal("general");
      // Change signals to non-default values
      sectionSignal.value = "users";
      tabSignal.value = "advanced";
      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      return {
        // Root route should ALWAYS stay as "/" even with non-default child signals
        // Users must be able to navigate to home page regardless of app state
        root_with_no_params: ROOT_ROUTE.buildUrl({}),
        root_with_empty_params: ROOT_ROUTE.buildUrl(),

        // For comparison - child routes should use deepest URL when no params provided
        admin_no_params: ADMIN_ROUTE.buildUrl({}), // Should potentially use child route
        admin_settings_no_params: ADMIN_SETTINGS_ROUTE.buildUrl({}), // Should use signal

        // Verify signals have non-default values
        signal_values: {
          section: sectionSignal.value, // "users" (non-default)
          tab: tabSignal.value, // "advanced" (non-default)
        },
        defaults: {
          section: "settings",
          tab: "general",
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("debug deepest url generation", () => {
    try {
      // Simple test case to see what's happening
      const tabSignal = stateSignal("overview", { id: "debug_tab" });
      tabSignal.value = "details"; // non-default
      // Register admin route that should upgrade to analytics when section=analytics
      const { ADMIN_ROUTE, ANALYTICS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section/`,
        ANALYTICS_ROUTE: `/admin/analytics?tab=${tabSignal}`,
      });
      return {
        // Test with explicit section=analytics
        admin_with_analytics_section: ADMIN_ROUTE.buildUrl({
          section: "analytics",
        }),
        // Test without params (should use default section which won't match analytics)
        admin_with_no_params: ADMIN_ROUTE.buildUrl({}),

        // For comparison
        analytics_direct: ANALYTICS_ROUTE.buildUrl({}),

        // Signal value
        tab_signal: tabSignal.value,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("deepest url generation with search parameters", () => {
    // Mock localStorage to reproduce the real scenario
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
      // Set up localStorage with analytics tab having non-default value
      localStorageMock.setItem("section_deepest", "analytics"); // non-default
      localStorageMock.setItem("analytics_tab_deepest", "details"); // non-default
      localStorageMock.setItem("settings_tab_deepest", "general"); // default

      // Create signals with localStorage persistence (like real app)
      const sectionSignal = stateSignal("settings", {
        id: "section_deepest",
        persists: true,
        type: "string",
      });
      const settingsTabSignal = stateSignal("general", {
        id: "settings_tab_deepest",
        persists: true,
        type: "string",
      });
      const analyticsTabSignal = stateSignal("overview", {
        id: "analytics_tab_deepest",
        persists: true,
        type: "string",
      });

      // Register routes like dashboard_demo.jsx:
      // - Admin route with path parameter: /admin/:section/
      // - Analytics route with search parameter: /admin/analytics/?tab=signal
      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_ANALYTICS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });

      return {
        // Reproduce the scenario: on root route, with analytics tab in localStorage
        // This should generate deepest URL including analytics tab from localStorage
        admin_route_from_root: ADMIN_ROUTE.buildUrl({}),

        // For comparison - direct analytics route URL
        analytics_route_direct: ADMIN_ANALYTICS_ROUTE.buildUrl({}),

        // Verify localStorage values
        localStorage_values: {
          section: localStorageMock.getItem("section_deepest"),
          analytics_tab: localStorageMock.getItem("analytics_tab_deepest"),
          settings_tab: localStorageMock.getItem("settings_tab_deepest"),
        },

        // Verify signal values (should reflect localStorage)
        signal_values: {
          section: sectionSignal.value,
          analytics_tab: analyticsTabSignal.value,
          settings_tab: settingsTabSignal.value,
        },

        // Test root route (should not use deepest URL)
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

      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_TIME_WALK_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zone=${zoneIdSignal}&style=${mapboxStyleSignal}&lon=${mapboxLongitudeSignal}&lat=${mapboxLatitudeSignal}&zoom=${mapboxZoomSignal}&sidebar=${mapSidebarOpenedSignal}`,
          MAP_ISOCHRONE_ROUTE: "/map/isochrone",
          MAP_ISOCHRONE_TIME_WALK_ROUTE: `/map/isochrone/walk?time=${isochromeWalkTimeSignal}`,
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
      const isochroneTimeWalkRoute = MAP_ISOCHRONE_TIME_WALK_ROUTE.buildUrl();

      isochromeWalkTimeSignal.value = 40;
      const isochroneTimeWalkRouteAfterChange =
        MAP_ISOCHRONE_TIME_WALK_ROUTE.buildUrl();

      return {
        map_url_defaults: urlWithDefaults,
        map_url_with_zoom: urlAfterZoomChange,
        map_url_with_zoom_overridden: urlWithZoomOverridden,
        map_isochrone_url_with_zoom: isochroneUrl,
        map_isochrone_time_walk_url_with_zoom: isochroneTimeWalkRoute,
        map_isochrone_time_walk_url_after_change:
          isochroneTimeWalkRouteAfterChange,
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

      // Set initial values: walkEnabled=false, walkMinute=40
      walkEnabledSignal.value = false;
      walkMinuteSignal.value = 40;

      const { ISOCHRONE_ROUTE } = setupRoutes({
        ISOCHRONE_ROUTE: `/map/isochrone/:tab?`,
        ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkEnabledSignal}&walk_minute=${walkMinuteSignal}`,
      });

      // Test buildUrl directly to see if child signals are found
      const urlWithWalkTrue = ISOCHRONE_ROUTE.buildUrl({ walk: true });
      const urlWithoutParams = ISOCHRONE_ROUTE.buildUrl();
      const urlWithTabAndWalk = ISOCHRONE_ROUTE.buildUrl({
        tab: "settings",
        walk: true,
      });

      return {
        signal_values: {
          walk_enabled: walkEnabledSignal.value, // false
          walk_minute: walkMinuteSignal.value, // 40
        },

        url_tests: {
          // Should find walkMinuteSignal=40 from child pattern even with walk=true provided
          url_with_walk_true: urlWithWalkTrue,
          // Should generate deepest URL using all signal values
          url_without_params: urlWithoutParams,
          // Should combine provided params with child signals
          url_with_tab_and_walk: urlWithTabAndWalk,
        },

        expected_behavior: {
          walk_true_should_contain: "walk_minute=40",
          should_choose_compare_route:
            "because it has both walk and walk_minute signals",
          expected_url_pattern:
            "/map/isochrone/compare?walk=true&walk_minute=40",
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("settings route should return /admin when all params are defaults", () => {
    try {
      // Parent route default matches child literal "settings" - this enables optimization
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
        // Core issue: When both signals are at defaults, settings route should optimize to shortest equivalent URL
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({ tab: "general" }), // Should be "/admin", not "/admin/settings"
        admin_url: ADMIN_ROUTE.buildUrl(), // For comparison
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("settings route should return /admin second case", () => {
    try {
      // Parent route default matches child literal "settings" - this enables optimization
      const sectionSignal = stateSignal("settings");
      const settingsTabSignal = stateSignal("general");
      const analyticsTabSignal = stateSignal("overview");

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${settingsTabSignal}`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });

      updateRoutes(`${baseUrl}/admin/analytics`);

      return {
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl(), // Should be "/admin", not "/admin/settings"
        admin_url: ADMIN_ROUTE.buildUrl(), // For comparison
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

      // Pattern defines order: a, b, c
      const { ROUTE } = setupRoutes({
        ROUTE: `/test?a=${aSignal}&b=${bSignal}&c=${cSignal}`,
      });

      return {
        pattern_order: "Pattern defines: a, b, c",

        // Test 1: No provided params - should follow pattern order
        no_provided_params: ROUTE.buildUrl(),

        // Test 2: Provided params in same order as pattern
        provided_same_order: ROUTE.buildUrl({
          a: "new-a",
          b: "new-b",
          c: "new-c",
        }),

        // Test 3: Provided params in different order - should still follow pattern order
        provided_different_order: ROUTE.buildUrl({
          c: "new-c",
          a: "new-a",
          b: "new-b",
        }),

        // Test 4: Partial provided params - pattern params first, then extras
        partial_provided: ROUTE.buildUrl({ b: "new-b" }),

        // Test 5: Extra params not in pattern - should come after pattern params
        extra_params: ROUTE.buildUrl({
          d: "extra-d",
          b: "new-b",
          e: "extra-e",
        }),

        // Test 6: Mixed case - pattern params + extras, provided in random order
        mixed_order: ROUTE.buildUrl({
          e: "extra-e",
          c: "new-c",
          d: "extra-d",
          a: "new-a",
        }),

        expected_behavior: {
          rule1:
            "Pattern params should always come first in their pattern order",
          rule2: "Extra params should come after pattern params",
          rule3:
            "Order of provided params object should not affect URL param order",
          rule4:
            "Extra params order should be consistent (alphabetical or insertion order)",
        },
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
        // Parent pattern with some query params
        SEARCH_ROUTE: `/search?filter=${filterSignal}&sort=${sortSignal}`,
        // Child pattern with additional query params
        SEARCH_RESULTS_ROUTE: `/search/results?page=${pageSignal}&limit=20`,
      });

      return {
        patterns: {
          search: "?filter&sort",
          results: "?page&limit",
        },

        // Test buildUrl with different param combinations
        search_no_params: SEARCH_ROUTE.buildUrl(),
        search_partial_params: SEARCH_ROUTE.buildUrl({ sort: "date" }),
        search_with_extras: SEARCH_ROUTE.buildUrl({
          sort: "date",
          extra: "value",
          filter: "inactive",
          another: "param",
        }),

        results_no_params: SEARCH_RESULTS_ROUTE.buildUrl(),
        results_with_extras: SEARCH_RESULTS_ROUTE.buildUrl({
          page: 2,
          custom: "param",
          limit: 50,
          filter: "all", // This should be extra since it's not in results pattern
        }),

        expected_analysis: {
          search_param_order: "filter, sort, then extras alphabetically",
          results_param_order: "page, limit, then extras alphabetically",
          inheritance_note:
            "Child routes don't inherit parent query param order",
        },
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
      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_WALK_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zone=${zoneSignal}`,
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
      // Create a hierarchy that matches your example:
      // /map?zone=${zoneSignal} (ancestor)
      // /map/isochrone/?walk=${walkSignal} (child)
      const zoneSignal = stateSignal("zone-123", { id: "zone" });
      const styleSignal = stateSignal("streets", { id: "style" });
      const walkSignal = stateSignal(false, { id: "walk", type: "boolean" });
      const timeSignal = stateSignal(30, { id: "time", type: "number" });
      const modeSignal = stateSignal("driving", { id: "mode" });

      const { MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_WALK_ROUTE } = setupRoutes({
        // Ancestor: defines zone, style order
        MAP_ROUTE: `/map?zone=${zoneSignal}&style=${styleSignal}`,
        // Child: defines walk, time order
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/?walk=${walkSignal}&time=${timeSignal}`,
        // Grandchild: defines mode
        MAP_ISOCHRONE_WALK_ROUTE: `/map/isochrone/walk?mode=${modeSignal}`,
      });

      return {
        hierarchy_info: {
          ancestor: "MAP_ROUTE: ?zone&style",
          child: "MAP_ISOCHRONE_ROUTE: ?walk&time",
          grandchild: "MAP_ISOCHRONE_WALK_ROUTE: ?mode",
          expected_order:
            "zone, style, walk, time, mode (ancestor to child to grandchild)",
        },

        // Test 1: Child route should inherit ancestor params first
        child_with_all_params: MAP_ISOCHRONE_ROUTE.buildUrl({
          zone: "custom-zone",
          style: "satellite",
          walk: true,
          time: 45,
          extra: "param", // Should come after all pattern params
        }),

        // Test 2: Grandchild should have ancestor->child->grandchild order
        grandchild_with_all_params: MAP_ISOCHRONE_WALK_ROUTE.buildUrl({
          mode: "cycling",
          time: 20,
          zone: "another-zone",
          walk: true,
          style: "terrain",
          extra1: "first",
          extra2: "second", // Extra params should be alphabetical after pattern params
        }),

        // Test 3: Partial params - pattern hierarchy should still be respected
        child_partial_params: MAP_ISOCHRONE_ROUTE.buildUrl({
          walk: true,
          zone: "partial-zone", // Should still come first even though walk was provided first
        }),

        // Test 4: Only extra params - should be alphabetical
        child_only_extra_params: MAP_ISOCHRONE_ROUTE.buildUrl({
          zebra: "last",
          alpha: "first",
        }),

        // Test 5: Mixed signals and explicit params - hierarchy should be maintained
        mixed_scenario: (() => {
          // Set some signals to non-default values
          zoneSignal.value = "signal-zone";
          walkSignal.value = true;

          return MAP_ISOCHRONE_ROUTE.buildUrl({
            style: "explicit-style", // Should come after zone (from signal) but before walk
            time: 60, // Should come after walk (from signal)
          });
        })(),

        current_signal_values: {
          zone: zoneSignal.value,
          style: styleSignal.value,
          walk: walkSignal.value,
          time: timeSignal.value,
          mode: modeSignal.value,
        },
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
      const { MAP_ROUTE } = setupRoutes({
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
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parent route should ignore child route explicitely undefined", () => {
    try {
      const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
      const isochroneTabSignal = stateSignal("compare");
      const isoLonSignal = stateSignal(2);

      mapPanelSignal.value = "isochrone";
      isoLonSignal.value = 3;
      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isoLonSignal}`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare`,
      });

      return {
        map_url_normal: MAP_ROUTE.buildUrl(),
        map_url_panel_explicitely_undefined: MAP_ROUTE.buildUrl({
          panel: undefined,
        }),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("to be defined", () => {
    try {
      const mapPanelSignal = stateSignal(undefined, { id: "mapPanel" });
      const isochroneTabSignal = stateSignal("compare");

      mapPanelSignal.value = "isochrone";

      const { MAP_ISOCHRONE_COMPARE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare`,
      });

      return {
        isochrone_compare_url: MAP_ISOCHRONE_COMPARE_ROUTE.buildUrl({}),
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
        // Normal encoding
        normal_path: FILES_ROUTE.buildUrl({ path: "documents/readme.txt" }),
        normal_special_chars: FILES_ROUTE.buildUrl({
          path: "special chars & symbols",
        }),

        // Raw URL parts (bypassing encoding)
        raw_path: FILES_ROUTE.buildUrl({
          path: rawUrlPart("documents/readme.txt"),
        }),
        raw_special_chars: FILES_ROUTE.buildUrl({
          path: rawUrlPart("special chars & symbols"),
        }),
        raw_encoded_path: FILES_ROUTE.buildUrl({
          path: rawUrlPart("documents%2Freadme.txt"),
        }),

        // Raw URL parts in query parameters
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
