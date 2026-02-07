import { snapshotTests } from "@jsenv/snapshot";
import { batch } from "@preact/signals";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import {
  clearAllRoutes,
  setRouteIntegration,
  setupRoutes,
  updateRoutes,
} from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("replaceParams should use most specific route for redirect", () => {
    try {
      const zoomSignal = stateSignal(12, {
        id: "mapZoom",
        type: "number",
      });

      // Create routes with proper parent-child relationship
      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_ISOCHRONE_COMPARE_ROUTE } =
        setupRoutes({
          MAP_ROUTE: `/map/?zoom=${zoomSignal}`, // Parent route with trailing slash
          MAP_ISOCHRONE_ROUTE: `/map/isochrone`, // Intermediate child
          MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare`, // Deepest child
        });

      // Simulate being on the child route: /map/isochrone/compare?zoom=10
      updateRoutes(`${baseUrl}/map/isochrone/compare?zoom=10`);

      // Mock browser integration to track navigation calls
      const navToCalls = [];
      const routeIntegrationMock = {
        navTo: (url) => {
          navToCalls.push(url);
          updateRoutes(url);
          return Promise.resolve();
        },
      };
      setRouteIntegration(routeIntegrationMock);

      // This should trigger replaceParams on the parent route (which now matches due to trailing slash)
      // But the redirect should be handled by the most specific child route
      MAP_ROUTE.replaceParams({ zoom: 11 });

      return {
        // Route matching states
        map_matching: MAP_ROUTE.matching,
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
        compare_matching: MAP_ISOCHRONE_COMPARE_ROUTE.matching,

        // Track navigation calls
        nav_to_calls: navToCalls,

        // Expected: URL should preserve route structure and include the zoom parameter
        expected_redirect_url: "/map/isochrone/compare?zoom=11",

        // Actual result
        actual_redirect_url:
          navToCalls.length > 0 ? navToCalls[navToCalls.length - 1] : "none",

        // Test result - check if navigation happened to correct URL
        test_passes:
          navToCalls.length > 0 &&
          navToCalls[navToCalls.length - 1].includes("zoom=11"),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signal updates should trigger redirect on most specific matching route", () => {
    try {
      const zoomSignal = stateSignal(12, {
        id: "hierarchyZoom",
        type: "number",
      });

      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_COMPARE_ROUTE } = setupRoutes(
        {
          MAP_ROUTE: `/map?zoom=${zoomSignal}`,
          MAP_ISOCHRONE_ROUTE: `/map/isochrone?zoom=${zoomSignal}`,
          MAP_COMPARE_ROUTE: `/map/isochrone/compare?zoom=${zoomSignal}`,
        },
      );

      // Start on deeply nested route
      updateRoutes(`${baseUrl}/map/isochrone/compare?zoom=15`);

      const navToCalls = [];

      // Mock browser integration to track navigation calls
      const routeIntegrationMock = {
        navTo: (url) => {
          navToCalls.push(url);
          updateRoutes(url);
          return Promise.resolve();
        },
      };
      setRouteIntegration(routeIntegrationMock);

      // When signal changes, this should trigger replaceParams on all matching routes
      // but the actual redirect should happen on the most specific one
      zoomSignal.value = 20;

      return {
        // Route matching states
        routes_matching: {
          map: MAP_ROUTE.matching,
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
          compare: MAP_COMPARE_ROUTE.matching,
        },

        // Track navigation calls
        nav_to_calls: navToCalls,

        // Verify navigation happened to correct URL
        most_specific_url_used:
          navToCalls.length > 0 ? navToCalls[navToCalls.length - 1] : "none",

        // The URL that should be generated
        expected_url_pattern: "/map/isochrone/compare?zoom=20",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parameterized route vs literal route conflict after navigation", () => {
    try {
      const zoomSignal = stateSignal(10, {
        id: "conflictZoom",
        type: "number",
      });

      // Routes that create the conflict:
      // /map/ - base route with signal
      // /map/:panel/ - parameterized route
      // /map/isochrone/ - literal route that conflicts with :panel
      const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zoom=${zoomSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone`,
      });

      const navToCalls = [];

      // Mock browser integration to track navigation calls
      const routeIntegrationMock = {
        navTo: (url) => {
          navToCalls.push(url);
          updateRoutes(url);
          return Promise.resolve();
        },
      };
      setRouteIntegration(routeIntegrationMock);

      // STEP 1: Navigate to /map/isochrone/
      // This should match both MAP_PANEL_ROUTE (:panel = "isochrone") AND MAP_ISOCHRONE_ROUTE
      updateRoutes(`${baseUrl}/map/isochrone`);

      const step1State = {
        map_matching: MAP_ROUTE.matching,
        panel_matching: MAP_PANEL_ROUTE.matching,
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
      };

      // STEP 2: Navigate to /map/
      // Now we should be on the base route only
      updateRoutes(`${baseUrl}/map`);

      const step2State = {
        map_matching: MAP_ROUTE.matching,
        panel_matching: MAP_PANEL_ROUTE.matching,
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
      };

      // Clear navigation calls from initial setup
      navToCalls.length = 0;

      // STEP 3: Update the zoom signal
      // This should stay on /map/, not redirect to /map/isochrone/
      zoomSignal.value = 15;

      return {
        step1_route_matching: step1State,
        step2_route_matching: step2State,

        // After signal update - should navigate to stay on /map
        final_nav_to_calls: navToCalls,

        // Expected behavior: Should stay on /map?zoom=15
        expected_url: "/map?zoom=15",

        // Actual behavior
        actual_url:
          navToCalls.length > 0 ? navToCalls[navToCalls.length - 1] : "none",

        // Problem indicator: Should navigate to correct URL
        test_passes:
          navToCalls.length > 0 &&
          navToCalls[navToCalls.length - 1].includes("zoom=15"),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parameterized route conflict with shared signals", () => {
    try {
      const zoomSignal = stateSignal(10, {
        id: "sharedZoom",
        type: "number",
      });

      const panelSignal = stateSignal(undefined, {
        id: "panelValue",
        type: "string",
      });

      // Set panel signal to initial value
      panelSignal.value = "isochrone";

      // More realistic scenario where routes have signals that control parameters
      // This should reproduce the delegation issue
      const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zoom=${zoomSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel={navi_state_signal:panelValue}?zoom=${zoomSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone?zoom=${zoomSignal}`,
      });

      const navToCalls = [];
      const allNavToCalls = []; // Track ALL navigation calls including during navigation
      setRouteIntegration({
        navTo: (url) => {
          navToCalls.push(url);
          allNavToCalls.push(url);
          updateRoutes(url);
          return Promise.resolve();
        },
      });

      // SCENARIO:
      // 1. Start at /map/isochrone?zoom=10 (panel signal = "isochrone")
      updateRoutes(`${baseUrl}/map/isochrone?zoom=10`);

      const afterIsochrone = {
        url: `${baseUrl}/map/isochrone?zoom=10`,
        signal_values: {
          zoom: zoomSignal.value,
          panel: panelSignal.value,
        },
        routes: {
          map: MAP_ROUTE.matching,
          panel: MAP_PANEL_ROUTE.matching,
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
        },
      };

      // Clear navigation history after navigation
      navToCalls.length = 0;

      // 2. Navigate to /map?zoom=10 (but panel signal still = "isochrone")
      updateRoutes(`${baseUrl}/map?zoom=10`);

      const afterMap = {
        url: `${baseUrl}/map?zoom=10`,
        signal_values: {
          zoom: zoomSignal.value,
          panel: panelSignal.value,
        },
        routes: {
          map: MAP_ROUTE.matching,
          panel: MAP_PANEL_ROUTE.matching, // This might still be matching if panel="isochrone"!
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
        },
      };

      // Clear navigation history after navigation
      navToCalls.length = 0;

      // 3. Update zoom signal - this is where the bug should occur
      // If MAP_PANEL_ROUTE is still matching because panel="isochrone",
      // it might be considered "more specific" and redirect incorrectly
      zoomSignal.value = 25;

      return {
        after_isochrone_nav: afterIsochrone,
        after_map_nav: afterMap,

        // After signal update
        signal_update_nav_calls: navToCalls,

        // Expected: Should navigate to stay on /map
        expected_url_pattern: "/map?zoom=25",

        // Actual
        actual_url:
          navToCalls.length > 0 ? navToCalls[navToCalls.length - 1] : "none",

        // Full navigation history for debugging
        all_nav_calls_during_test: allNavToCalls,

        // Signal values at the end
        final_signal_values: {
          zoom: zoomSignal.value,
          panel: panelSignal.value,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signal should be cleared when route stops matching", () => {
    try {
      const zoomSignal = stateSignal(10, {
        id: "clearingTestZoom",
        type: "number",
      });

      const panelSignal = stateSignal(undefined, {
        id: "clearingTestPanel",
        type: "string",
      });

      // Set the panel signal to "isochrone" initially
      panelSignal.value = "isochrone";

      // Use two routes: one for base map, one for panel
      // The key is that when navigating from panel route to base route,
      // the panel signal should be cleared because the new URL doesn't include it
      const { MAP_ROUTE, MAP_PANEL_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zoom=${zoomSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel={navi_state_signal:clearingTestPanel}?zoom=${zoomSignal}`,
      });

      // Start with panel signal set to "isochrone"
      panelSignal.value = "isochrone";

      // Navigate to /map/isochrone - panel route should match
      updateRoutes(`${baseUrl}/map/isochrone?zoom=10`);

      const afterPanelNav = {
        url: `/map/isochrone?zoom=10`,
        panel_signal: panelSignal.value,
        routes: {
          map: MAP_ROUTE.matching,
          panel: MAP_PANEL_ROUTE.matching,
        },
      };

      // Navigate to /map - base route should match, panel route should not
      // The panel signal should remain as is (preserving user preference)
      updateRoutes(`${baseUrl}/map?zoom=10`);

      const afterMapNav = {
        url: `/map?zoom=10`,
        panel_signal: panelSignal.value,
        routes: {
          map: MAP_ROUTE.matching,
          panel: MAP_PANEL_ROUTE.matching,
        },
      };

      return {
        after_panel_nav: afterPanelNav,
        after_map_nav: afterMapNav,

        // Verify that routes match correctly
        panel_route_stops_matching:
          !afterMapNav.routes.panel && afterPanelNav.routes.panel,
        base_route_starts_matching:
          afterMapNav.routes.map && !afterPanelNav.routes.map,

        // Test pattern family behavior - signal should be cleared when navigating within same family
        signal_cleared_within_same_family: panelSignal.value === undefined,
        // Current signal value for debugging
        current_panel_signal: panelSignal.value,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signal preserved when nav to map", () => {
    const mapPanelSignal = stateSignal(undefined);
    const isochroneTabSignal = stateSignal("compare");
    const isochroneModeSignal = stateSignal("walk");
    try {
      setupRoutes({
        MAP_ROUTE: `/map/:panel=${mapPanelSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}`,
        MAP_ISOCHRONE_TIME_ROUTE: `/map/isochrone/time/:mode=${isochroneModeSignal}`,
      });
      updateRoutes(`${baseUrl}/map/isochrone/time/bike`);
      const state = {
        map_panel_signal_value: mapPanelSignal.value,
        isochrone_tab_signal_value: isochroneTabSignal.value,
        isochrone_mode_signal_value: isochroneModeSignal.value,
      };
      updateRoutes(`${baseUrl}/map`);
      const stateAfter = {
        map_panel_signal_value: mapPanelSignal.value,
        isochrone_tab_signal_value: isochroneTabSignal.value,
        isochrone_mode_signal_value: isochroneModeSignal.value,
      };
      return {
        state,
        stateAfter,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signal preservation vs clearing behavior", () => {
    try {
      const panelSignal = stateSignal(undefined, {
        id: "preservationTestPanel",
        type: "string",
      });

      // Set initial value
      panelSignal.value = "isochrone";

      // Use a route pattern that can handle the panel parameter
      const { MAP_PANEL_ROUTE } = setupRoutes({
        MAP_PANEL_ROUTE: `/map/:panel={navi_state_signal:preservationTestPanel}`,
        HOME_ROUTE: `/home`,
      });

      // SCENARIO 1: Navigate to /map/isochrone - signal should match URL
      updateRoutes(`${baseUrl}/map/isochrone`);

      const scenario1 = {
        url: "/map/isochrone",
        panel_signal: panelSignal.value,
        panel_route_matches: MAP_PANEL_ROUTE.matching,
      };

      // SCENARIO 2: Navigate to /home - signal should be preserved (different route pattern)
      updateRoutes(`${baseUrl}/home`);

      const scenario2 = {
        url: "/home",
        panel_signal: panelSignal.value, // Should remain "isochrone"
        panel_route_matches: MAP_PANEL_ROUTE.matching, // Should be false
      };

      // SCENARIO 3: Navigate back to /map/settings - signal should update from URL
      updateRoutes(`${baseUrl}/map/settings`);

      const scenario3 = {
        url: "/map/settings",
        panel_signal: panelSignal.value, // Should be "settings"
        panel_route_matches: MAP_PANEL_ROUTE.matching, // Should be true
      };

      // SCENARIO 4: Reset signal manually, then navigate to /map/dashboard
      panelSignal.value = "manual-value";
      updateRoutes(`${baseUrl}/map/dashboard`);

      const scenario4 = {
        url: "/map/dashboard",
        panel_signal: panelSignal.value, // Should be "dashboard" (URL overrides)
        panel_route_matches: MAP_PANEL_ROUTE.matching,
      };

      return {
        scenario1_initial_navigation: scenario1,
        scenario2_preserve_on_different_route: scenario2,
        scenario3_update_from_url: scenario3,
        scenario4_url_overrides_manual_value: scenario4,

        // Key behaviors to verify:
        signal_updates_from_url_initially:
          scenario1.panel_signal === "isochrone",
        signal_preserved_on_different_route:
          scenario2.panel_signal === "isochrone",
        signal_updates_from_new_url: scenario3.panel_signal === "settings",
        url_overrides_manual_value: scenario4.panel_signal === "dashboard",

        // Route matching behavior
        routes_match_correctly: [
          scenario1.panel_route_matches, // true
          scenario2.panel_route_matches, // false
          scenario3.panel_route_matches, // true
          scenario4.panel_route_matches, // true
        ],
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signal preserved when navigating between menu/tabs", () => {
    try {
      const sectionSignal = stateSignal("settings");
      const settingsTabSignal = stateSignal("general");
      const analyticsTabSignal = stateSignal("overview");
      const { ADMIN_SETTINGS_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${settingsTabSignal}`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });
      // simulate we're on settings advanced page
      updateRoutes(`${baseUrl}/admin/settings/advanced`);
      // and we nav to analytics
      updateRoutes(`${baseUrl}/admin/analytics`);
      // now we expect settings_url: to be "admin/settings/advanced" (settingsTabSignal value should be preserved)
      return {
        settings_url: ADMIN_SETTINGS_ROUTE.url,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("signals preserved when navigating between different route families", () => {
    try {
      const zoneSignal = stateSignal("foo", {
        id: "zone",
        type: "string",
      });

      // Create routes from different families with query parameter
      const { HOME_ROUTE, MAP_ROUTE } = setupRoutes({
        HOME_ROUTE: `/`, // Root page
        MAP_ROUTE: `/map?zone=${zoneSignal}`, // Map page with zone query parameter
      });

      // Start on the map route with a zone value: /map?zone=foo
      updateRoutes(`${baseUrl}/map?zone=foo`);

      const scenario1 = {
        description: "Initial state on /map?zone=foo",
        zone_signal: zoneSignal.value,
        home_route_matches: HOME_ROUTE.matching,
        map_route_matches: MAP_ROUTE.matching,
        current_url: globalThis.location?.href || "not available",
      };

      // Navigate to home page (root - different route family)
      updateRoutes(`${baseUrl}/`);

      const scenario2 = {
        description: "After navigating to root /",
        zone_signal: zoneSignal.value,
        home_route_matches: HOME_ROUTE.matching,
        map_route_matches: MAP_ROUTE.matching,
        current_url: globalThis.location?.href || "not available",
      };

      // Navigate back to map route to verify signal can be used
      updateRoutes(`${baseUrl}/map?zone=bar`);

      const scenario3 = {
        description: "Navigate back to /map with new zone value",
        zone_signal: zoneSignal.value,
        home_route_matches: HOME_ROUTE.matching,
        map_route_matches: MAP_ROUTE.matching,
        current_url: globalThis.location?.href || "not available",
      };

      return {
        scenario1_initial_map_route: scenario1,
        scenario2_navigate_to_home_root: scenario2,
        scenario3_back_to_map_with_new_value: scenario3,

        // Key test: signal should be preserved when moving between different route families
        // This is different from parent-child navigation where signals are cleared
        signal_preserved_across_families: scenario2.zone_signal === "foo", // Should still be "foo" from initial visit
        signal_updates_on_return: scenario3.zone_signal === "bar", // Should update to new value

        // Route matching verification
        routes_match_correctly: [
          scenario1.map_route_matches, // true - on /map?zone=foo
          scenario2.home_route_matches, // true - on /
          scenario3.map_route_matches, // true - on /map?zone=bar
        ],

        // Explanation of behavior:
        explanation: {
          why_preserved:
            "/ (root) and /map are different route families (different trees)",
          why_different_from_parent_child:
            "Unlike /map -> /map/isochrone (parent-child), /map -> / are separate trees",
          user_benefit:
            "Preserves map zone preference when user navigates to home and back",
          query_param_note:
            "Zone is now a query parameter (?zone=foo) instead of path parameter",
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("mostSpecificRoute should prefer literal over parameterized routes", () => {
    const navToCalls = [];
    const routeIntegrationMock = {
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    };
    setRouteIntegration(routeIntegrationMock);

    try {
      const walkEnabledSignal = stateSignal(false, {
        id: "mostSpecificWalkEnabled",
        type: "boolean",
      });
      const walkMinuteSignal = stateSignal(30, {
        id: "mostSpecificWalkMinute",
        type: "number",
      });
      const isochroneTabSignal = stateSignal("compare", {
        id: "mostSpecificIsochroneTab",
        type: "string",
      });
      const isochroneLongitudeSignal = stateSignal(2.3522, {
        id: "mostSpecificIsochroneLongitude",
        type: "number",
      });

      // These two routes should demonstrate the specificity issue:
      // - ISOCHRONE_ROUTE: `/map/isochrone/:tab` (generic with :tab parameter)
      // - ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare` (literal with "compare")
      // ISOCHRONE_COMPARE_ROUTE should be considered more specific
      const { ISOCHRONE_ROUTE, ISOCHRONE_COMPARE_ROUTE } = setupRoutes({
        ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isochroneLongitudeSignal}`,
        ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkEnabledSignal}&walk_minute=${walkMinuteSignal}`,
      });

      // Navigate to the compare route
      updateRoutes(`${baseUrl}/map/isochrone/compare`);

      const routeMatching = {
        isochrone_matches: ISOCHRONE_ROUTE.matching,
        compare_matches: ISOCHRONE_COMPARE_ROUTE.matching,
      };

      // Calculate segments the current way (which is problematic)
      const isochroneSegments = ISOCHRONE_ROUTE.pattern
        .split("/")
        .filter((s) => s !== "").length;
      const compareSegments = ISOCHRONE_COMPARE_ROUTE.pattern
        .split("/")
        .filter((s) => s !== "").length;

      // Trigger a replaceParams to see which route is considered most specific
      walkEnabledSignal.value = true;

      return {
        route_patterns: {
          isochrone: ISOCHRONE_ROUTE.pattern,
          compare: ISOCHRONE_COMPARE_ROUTE.pattern,
        },
        segment_counts: {
          isochrone: isochroneSegments,
          compare: compareSegments,
        },
        route_matching: routeMatching,
        nav_to_calls: navToCalls,
        most_specific_url_used:
          navToCalls.length > 0 ? navToCalls[navToCalls.length - 1] : "none",

        // Analysis:
        expected_most_specific_url: "/map/isochrone/compare?walk", // Should navigate to compare route with walk param
        actual_segments_comparison: {
          problem: `Current code counts segments: isochrone=${isochroneSegments}, compare=${compareSegments}`,
          issue:
            "The code might incorrectly consider ISOCHRONE_ROUTE more specific due to query params",
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("signal updates in child route (isochrone) with parent-child relationship", () => {
    // Track navTo calls as URL progression
    const urlProgression = [];
    const routeIntegrationMock = {
      navTo: (url) => {
        urlProgression.push(url);
      },
    };
    setRouteIntegration(routeIntegrationMock);

    try {
      const walkEnabledSignal = stateSignal(false);
      const walkMinuteSignal = stateSignal(30);
      const zoneSignal = stateSignal("paris");
      const isochroneTabSignal = stateSignal("compare");
      const isochroneLongitudeSignal = stateSignal(2.3522);
      const mapPanelSignal = stateSignal(undefined);
      mapPanelSignal.value = "isochrone";
      isochroneLongitudeSignal.value = 10;
      zoneSignal.value = "nice";
      const { ISOCHRONE_COMPARE_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isochroneLongitudeSignal}`,
        ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkEnabledSignal}&walk_minute=${walkMinuteSignal}`,
        MAP_ISOCHRONE_TIME_ROUTE: "/map/isochrone/time/",
        MAP_ISOCHRONE_TIME_WALK_ROUTE: "/map/isochrone/time/walk",
      });
      updateRoutes(`${baseUrl}/map/isochrone/compare?zone=nice&iso_lon=10`);

      const scenario1 = {
        enabled_signal: walkEnabledSignal.value,
        minute_signal: walkMinuteSignal.value,
        current_url: ISOCHRONE_COMPARE_ROUTE.url,
      };

      // Clear URL progression before testing signal updates
      urlProgression.length = 0;
      // Update enabled signal to true (non-default)
      walkEnabledSignal.value = true;
      const scenario2 = {
        enabled_signal: walkEnabledSignal.value,
        current_url: ISOCHRONE_COMPARE_ROUTE.url,
        nav_to_calls: [...urlProgression],
      };

      // Clear URL progression
      urlProgression.length = 0;
      // Update minute signal
      walkMinuteSignal.value = 45;
      const scenario3 = {
        minute_signal: walkMinuteSignal.value,
        current_url: ISOCHRONE_COMPARE_ROUTE.url,
        nav_to_calls: [...urlProgression],
      };

      // Clear URL progression
      urlProgression.length = 0;
      // Update enabled back to false (default)
      walkEnabledSignal.value = false;
      const scenario4 = {
        enabled_signal: walkEnabledSignal.value,
        current_url: ISOCHRONE_COMPARE_ROUTE.url,
        nav_to_calls: [...urlProgression],
      };

      // Clear URL progression
      urlProgression.length = 0;
      // Update minute signal again
      walkMinuteSignal.value = 60;
      const scenario5 = {
        minute_signal: walkMinuteSignal.value,
        current_url: ISOCHRONE_COMPARE_ROUTE.url,
        nav_to_calls: [...urlProgression],
      };

      return {
        scenario1_initial: scenario1,
        scenario2_enabled_true: scenario2,
        scenario3_minute_45: scenario3,
        scenario4_enabled_false: scenario4,
        scenario5_minute_60: scenario5,
      };
    } finally {
      setRouteIntegration(undefined);
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("parameter value update in URL should sync to signal values", () => {
    // Mock browserIntegration.navTo to track redirectTo calls
    const navToCalls = [];
    const routeIntegrationMock = {
      navTo: (url) => {
        navToCalls.push(url);
      },
    };
    setRouteIntegration(routeIntegrationMock);

    try {
      const zoneSignal = stateSignal("london");
      const lonSignal = stateSignal(3);
      const isochroneTabSignal = stateSignal("compare");
      const isochroneLongitudeSignal = stateSignal(2);
      const isochroneTimeModeSignal = stateSignal("walk");

      const {
        MAP_ISOCHRONE_ROUTE,
        MAP_ISOCHRONE_COMPARE_ROUTE,
        MAP_ISOCHRONE_TIME_ROUTE,
      } = setupRoutes({
        MAP_ROUTE: `/map/?zone=${zoneSignal}&lon=${lonSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isochroneLongitudeSignal}`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare`,
        MAP_ISOCHRONE_TIME_ROUTE: `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
      });

      updateRoutes(`${baseUrl}/map/isochrone?zone=london&lon=3&iso_lon=2`);
      // Capture initial state
      const initialState = {
        matching: {
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
          isochrone_compare: MAP_ISOCHRONE_COMPARE_ROUTE.matching,
          isochrone_time: MAP_ISOCHRONE_TIME_ROUTE.matching,
        },
      };
      // Clear navTo calls from initial setup
      navToCalls.length = 0;
      // Update URL to /map/isochrone/time?zone=longon&lon=3&iso_lon=2 (zone typo: london -> longon)
      updateRoutes(`${baseUrl}/map/isochrone/time?zone=longon&lon=3&iso_lon=2`);
      // Capture state after URL update
      const finalState = {
        matching: {
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
          isochrone_compare: MAP_ISOCHRONE_COMPARE_ROUTE.matching,
          isochrone_time: MAP_ISOCHRONE_TIME_ROUTE.matching,
        },
      };

      return {
        initial_state: initialState,
        final_state: finalState,
        redirect_calls: {
          nav_to_calls: navToCalls,
          total_calls: navToCalls.length,
          any_redirects_occurred: navToCalls.length > 0,
        },
      };
    } finally {
      setRouteIntegration(undefined);
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("updating signals keep url in sync", () => {
    // Mock browser integration to capture navigation calls
    let navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });

    try {
      const categorySignal = stateSignal("electronics");
      const { CATEGORY_ROUTE } = setupRoutes({
        CATEGORY_ROUTE: `/products?category=${categorySignal}`,
      });
      // Navigate to initial URL - this should set signal to "electronics"
      updateRoutes(`${baseUrl}/products?category=electronics`);
      // Clear navigation calls from initial setup
      navToCalls = [];

      // TEST: Signal update should trigger navigation and update route params
      // Without circular dependency fix, route params would be stale
      categorySignal.value = "books";

      return {
        initialSignalValue: "electronics", // After URL parsing
        finalSignalValue: categorySignal.value, // After programmatic update
        navToCallsCount: navToCalls.length, // Should be 1 (Signal->URL only)
        navToCalls,
        routeMatching: CATEGORY_ROUTE.matching,
        routeParams: CATEGORY_ROUTE.params,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("updating signals after url change preserves signal value (no circular dependency)", () => {
    // Mock browser integration
    let navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });

    try {
      const priceSignal = stateSignal(100, { type: "number" });
      const { SHOP_ROUTE } = setupRoutes({
        SHOP_ROUTE: `/shop?maxPrice=${priceSignal}`,
      });
      // Initial state - route matching with price=50
      updateRoutes(`${baseUrl}/shop?maxPrice=50`);
      const priceAfterUrlUpdate = priceSignal.value; // Should be 50
      // Clear calls from setup
      navToCalls = [];

      // TEST: After URL change updates signal, immediate signal update should be preserved
      // This tests the timing issue: URL->Signal effect should not overwrite subsequent signal changes
      // Different from previous test: this tests URL change FOLLOWED BY signal change stability
      priceSignal.value = 200;
      const priceAfterSignalUpdate = priceSignal.value; // Should remain 200

      return {
        priceAfterUrlUpdate, // Should be 50 (from URL)
        priceAfterSignalUpdate, // Should be 200 (from signal update)
        signalValueStable: priceAfterSignalUpdate === 200, // Should be true
        navToCallsCount: navToCalls.length, // Should be 1
        lastNavigatedUrl: navToCalls[navToCalls.length - 1],
        routeParams: SHOP_ROUTE.params,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("updating url keep signals in sync", () => {
    // Mock browser integration to ensure no navigation calls are made
    let navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        return Promise.resolve();
      },
    });

    try {
      const categorySignal = stateSignal("electronics");
      const sortSignal = stateSignal("name");

      const { PRODUCTS_ROUTE } = setupRoutes({
        PRODUCTS_ROUTE: `/products?category=${categorySignal}&sort=${sortSignal}`,
      });

      // Initial state
      const initialCategoryValue = categorySignal.value;
      const initialSortValue = sortSignal.value;

      // URL -> Signal: Call updateRoutes with new URL parameters
      updateRoutes(`${baseUrl}/products?category=books&sort=price`);

      return {
        initialCategoryValue, // Should be "electronics"
        initialSortValue, // Should be "name"
        updatedCategoryValue: categorySignal.value, // Should be "books"
        updatedSortValue: sortSignal.value, // Should be "price"
        navToCallsCount: navToCalls.length, // Should be 0 (no navigation triggered)
        routeMatching: PRODUCTS_ROUTE.matching, // Should be true
        routeParams: PRODUCTS_ROUTE.params, // Should reflect new URL params
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("updating url with missing parameters uses signal current values", () => {
    // Mock browser integration
    let navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        return Promise.resolve();
      },
    });

    try {
      const pageSignal = stateSignal(1, { type: "number" }); // Default page is 1
      const limitSignal = stateSignal(10, { type: "number" }); // Default limit is 10

      const { SEARCH_ROUTE } = setupRoutes({
        SEARCH_ROUTE: `/search?page=${pageSignal}&limit=${limitSignal}`,
      });

      // Set some initial non-default values
      pageSignal.value = 5;
      limitSignal.value = 25;

      // URL -> Signal: Navigate to URL that only has one parameter
      updateRoutes(`${baseUrl}/search?page=3`);

      return {
        pageSignalValue: pageSignal.value, // Should be 3 (from URL)
        limitSignalValue: limitSignal.value, // Should be undefined (URL doesn't provide it)
        navToCallsCount: navToCalls.length, // Should be 0 (no navigation triggered)
        routeMatching: SEARCH_ROUTE.matching, // Should be true
        routeParams: SEARCH_ROUTE.params, // Should match URL structure
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("updating boolean signal", () => {
    let urlProgression = [];
    setRouteIntegration({
      navTo: (url) => {
        urlProgression.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });

    try {
      const walkSignal = stateSignal(false, { type: "boolean" }); // Default walk is false
      const walkMinuteSignal = stateSignal(20, { type: "number" }); // Default walk minutes is 10
      setupRoutes({
        ISOCHRONE_ROUTE: `/isochrone?walk=${walkSignal}&walk_minute=${walkMinuteSignal}`,
      });
      updateRoutes(`${baseUrl}/isochrone`);
      walkSignal.value = true;
      walkMinuteSignal.value = 30;

      return urlProgression;
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("updating with dynamic default", () => {
    const urlProgression = [];
    setRouteIntegration({
      navTo: (url) => {
        urlProgression.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });
    const mockStorage = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key) => mockStorage.get(key) || null,
        setItem: (key, value) => mockStorage.set(key, value),
        removeItem: (key) => mockStorage.delete(key),
        clear: () => mockStorage.clear(),
      },
    };

    try {
      // Define signals first so they're available in the callback
      const zoneLonSignal = stateSignal(undefined);
      const mapLonSignal = stateSignal(zoneLonSignal, {
        default: -1,
        type: "float",
        persists: true,
      });
      const isoLonSignal = stateSignal(zoneLonSignal, { type: "float" });
      const mapPanelSignal = stateSignal(undefined);
      const { MAP_ISOCHRONE_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?lon=${mapLonSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone?iso_lon=${isoLonSignal}`,
      });
      const captureState = () => {
        return {
          url: MAP_ISOCHRONE_ROUTE.url,
          signal_values: {
            zoneLon: zoneLonSignal.value,
            mapLon: mapLonSignal.value,
            isoLon: isoLonSignal.value,
          },
        };
      };
      updateRoutes(`${baseUrl}/map/isochrone`);
      const stateAtStart = captureState();
      zoneLonSignal.value = 2;
      const stateAfterZoneChange = captureState();
      mapLonSignal.value = 5;
      const stateAfterMovingMap = captureState();
      mapLonSignal.value = zoneLonSignal.value;
      const stateAfterSyncingMapToZone = captureState();

      return {
        urlProgression,
        state_at_start: stateAtStart,
        state_after_zone_change: stateAfterZoneChange,
        state_after_moving_map: stateAfterMovingMap,
        state_after_syncing_map_to_zone: stateAfterSyncingMapToZone,
      };
    } finally {
      delete globalThis.window;
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("reset center", () => {
    const urlProgression = [];
    setRouteIntegration({
      navTo: (url) => {
        urlProgression.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });

    try {
      // Define signals first so they're available in the callback
      const zoneLonSignal = stateSignal(undefined);
      const zoneLatSignal = stateSignal(undefined);
      const mapLonSignal = stateSignal(zoneLonSignal, {
        default: -1,
        type: "float",
      });
      const mapLatSignal = stateSignal(zoneLatSignal, {
        default: -2,
        type: "float",
      });
      const isoLonSignal = stateSignal(zoneLonSignal, { type: "float" });
      const isoLatSignal = stateSignal(zoneLatSignal, { type: "float" });
      const mapPanelSignal = stateSignal(undefined);
      const { MAP_ISOCHRONE_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?lon=${mapLonSignal}&lat=${mapLatSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone?iso_lon=${isoLonSignal}&iso_lat=${isoLatSignal}`,
      });
      const captureState = () => {
        return {
          url: MAP_ISOCHRONE_ROUTE.url,
          signal_values: {
            zoneLon: zoneLonSignal.value,
            mapLon: mapLonSignal.value,
            mapLat: mapLatSignal.value,
            isoLon: isoLonSignal.value,
            isoLat: isoLatSignal.value,
          },
        };
      };

      updateRoutes(`${baseUrl}/map/isochrone`);
      const stateAtStart = captureState();
      batch(() => {
        zoneLonSignal.value = 2;
        zoneLatSignal.value = 3;
      });
      const stateAfterZoneChange = captureState();
      batch(() => {
        mapLonSignal.value = 5;
        mapLatSignal.value = 6;
      });
      const stateAfterMovingMap = captureState();
      batch(() => {
        isoLonSignal.value = 7;
        isoLatSignal.value = 8;
      });
      const stateAfterMovingIsochrone = captureState();
      batch(() => {
        isoLonSignal.value = undefined;
        isoLatSignal.value = undefined;
      });
      const stateAfterResetIsochrone = captureState();
      batch(() => {
        mapLonSignal.value = zoneLonSignal.value;
        mapLatSignal.value = zoneLatSignal.value;
      });
      const stateAfterCenterMapOnZone = captureState();

      return {
        urlProgression,
        state_at_start: stateAtStart,
        state_after_zone_change: stateAfterZoneChange,
        state_after_moving_map: stateAfterMovingMap,
        state_after_moving_isochrone: stateAfterMovingIsochrone,
        state_after_reset_isochrone: stateAfterResetIsochrone,
        state_after_reset_map_on_zone: stateAfterCenterMapOnZone,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(undefined);
    }
  });

  test("signal forces url back to parameterized route incorrectly", () => {
    // Mock localStorage to simulate the bug scenario
    const mockStorage = new Map();
    mockStorage.set("odt_map_panel", "isochrone"); // Pre-populate with previous session data
    globalThis.window = {
      localStorage: {
        getItem: (key) => mockStorage.get(key) || null,
        setItem: (key, value) => mockStorage.set(key, value),
        removeItem: (key) => mockStorage.delete(key),
        clear: () => mockStorage.clear(),
      },
    };

    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
      },
    });

    try {
      // Create signal with persist: true to reproduce the localStorage issue
      const mapPanelSignal = stateSignal(undefined, {
        id: "odt_map_panel",
        persist: true,
      });
      const zoneSignal = stateSignal(undefined);
      const isochroneTabSignal = stateSignal("compare");
      const isochroneLongitudeSignal = stateSignal(2.3522);
      const isochroneWalkSignal = stateSignal(false);
      const isochroneTimeModeSignal = stateSignal("walk");

      const { MAP_ROUTE, MAP_PANEL_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isochroneLongitudeSignal}`,
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${isochroneWalkSignal}`,
        MAP_ISOCHRONE_TIME_ROUTE: `/map/isochrone/time/:mode=${isochroneTimeModeSignal}/`,
      });

      // Step 1: Navigate to /map/isochrone - this should set mapPanelSignal and localStorage
      updateRoutes(`${baseUrl}/map/isochrone?zone=london`);

      const afterIsochroneNav = {
        panel_signal_value: mapPanelSignal.value,
        map_route_matching: MAP_ROUTE.matching,
        panel_route_matching: MAP_PANEL_ROUTE.matching,
        localStorage_value: mockStorage.get("odt_map_panel"),
      };

      // Clear navTo calls before the critical test
      navToCalls.length = 0;

      // Step 2: Navigate to /map - this should NOT redirect back to /map/isochrone
      // But the bug is: localStorage restores "isochrone" value and forces redirect
      updateRoutes(`${baseUrl}/map?zone=london`);

      const afterMapNav = {
        panel_signal_value: mapPanelSignal.value,
        map_route_matching: MAP_ROUTE.matching,
        panel_route_matching: MAP_PANEL_ROUTE.matching,
        localStorage_value: mockStorage.get("odt_map_panel"),
        nav_to_calls: [...navToCalls],
      };

      return {
        after_isochrone_nav: afterIsochroneNav,
        after_map_nav: afterMapNav,
        bug_reproduced: navToCalls.some((url) =>
          url.includes("/map/isochrone"),
        ),
      };
    } finally {
      delete globalThis.window;
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("signal update should stay on current route", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
      },
    });

    try {
      const mapPanelSignal = stateSignal(undefined);
      const lonSignal = stateSignal(undefined);
      const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_FLOW_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?lon=${lonSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
        MAP_FLOW_ROUTE: `/map/flow/`,
      });

      // Step 1: Navigate to /map - we're on the base map route
      updateRoutes(`${baseUrl}/map`);

      const afterMapNav = {
        current_url: "/map",
        panel_signal_value: mapPanelSignal.value, // Should be undefined
        map_route_matching: MAP_ROUTE.matching,
        panel_route_matching: MAP_PANEL_ROUTE.matching,
        flow_route_matching: MAP_FLOW_ROUTE.matching,
        navToCalls: [...navToCalls],
      };

      // Clear navTo calls before the critical test
      navToCalls.length = 0;

      // Step 2: Update lonSignal - this should stay on /map?lon=20, NOT redirect to /map/flow/
      // BUG: System incorrectly chooses /map/flow/ as "deepest child" even though:
      // - mapPanelSignal.value = undefined
      // - /map/flow/ requires panel = "flow"
      // - These are INCOMPATIBLE
      lonSignal.value = 20;

      const afterUpdatingLon = {
        lon_signal_value: lonSignal.value, // Should be 20
        panel_signal_value: mapPanelSignal.value, // Should STILL be undefined
        map_route_matching: MAP_ROUTE.matching,
        panel_route_matching: MAP_PANEL_ROUTE.matching,
        flow_route_matching: MAP_FLOW_ROUTE.matching,
        navToCalls: [...navToCalls],
      };

      return {
        after_map_nav: afterMapNav,
        after_updating_lon: afterUpdatingLon,

        // BUG DETECTION
        bug_reproduced: navToCalls.some((url) => url.includes("/map/flow")),

        // EXPECTED: Should stay on /map?lon=20
        expected_url: "/map?lon=20",
        actual_nav_calls: navToCalls,

        // ANALYSIS: Why /map/flow/ should be INCOMPATIBLE
        compatibility_analysis: {
          current_panel_signal: mapPanelSignal.value, // undefined
          flow_route_requires: "panel = 'flow'",
          are_compatible: mapPanelSignal.value === "flow", // Should be false
          issue:
            "/map/flow/ should not be selected when mapPanelSignal.value = undefined",
          correct_behavior: "Should stay on /map/ with updated lon parameter",
        },

        // DEBUG INFO
        signal_values_during_update: {
          mapPanelSignal: mapPanelSignal.value,
          lonSignal: lonSignal.value,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("signal update should stay on current route (dynamic segment test)", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
      },
    });

    try {
      const tabSignal = stateSignal(undefined);
      const lonSignal = stateSignal(undefined);
      const { DASHBOARD_ROUTE, DASHBOARD_TAB_ROUTE } = setupRoutes({
        DASHBOARD_ROUTE: `/dashboard/?lon=${lonSignal}`,
        DASHBOARD_TAB_ROUTE: `/dashboard/:tab=${tabSignal}/`,
      });

      // Step 1: Navigate to /dashboard - we're on the base dashboard route
      updateRoutes(`${baseUrl}/dashboard`);

      const afterDashboardNav = {
        current_url: "/dashboard",
        tab_signal_value: tabSignal.value, // Should be undefined
        dashboard_route_matching: DASHBOARD_ROUTE.matching,
        dashboard_tab_route_matching: DASHBOARD_TAB_ROUTE.matching,
        navToCalls: [...navToCalls],
      };

      // Clear navTo calls before the critical test
      navToCalls.length = 0;

      // Step 2: Update lonSignal - this should stay on /dashboard?lon=20
      // BUG WOULD BE: System incorrectly chooses /dashboard/:tab route even though:
      // - tabSignal.value = undefined
      // - /dashboard/:tab requires a tab parameter
      // - These are INCOMPATIBLE (undefined cannot fill :tab parameter)
      lonSignal.value = 20;

      const afterUpdatingLon = {
        lon_signal_value: lonSignal.value, // Should be 20
        tab_signal_value: tabSignal.value, // Should STILL be undefined
        dashboard_route_matching: DASHBOARD_ROUTE.matching,
        dashboard_tab_route_matching: DASHBOARD_TAB_ROUTE.matching,
        navToCalls: [...navToCalls],
      };

      return {
        after_dashboard_nav: afterDashboardNav,
        after_updating_lon: afterUpdatingLon,

        // BUG DETECTION: Should NOT navigate to child route with dynamic segment
        bug_reproduced: navToCalls.some((url) =>
          url.includes("/dashboard/undefined"),
        ),

        // EXPECTED: Should stay on /dashboard?lon=20
        expected_url: "/dashboard?lon=20",
        actual_nav_calls: navToCalls,

        // ANALYSIS: Why /dashboard/:tab should be INCOMPATIBLE
        compatibility_analysis: {
          current_tab_signal: tabSignal.value, // undefined
          tab_route_requires: "tab parameter (non-undefined)",
          are_compatible: tabSignal.value !== undefined, // Should be false
          issue:
            "/dashboard/:tab should not be selected when tabSignal.value = undefined",
          correct_behavior:
            "Should stay on /dashboard/ with updated lon parameter",
          dynamic_segment_note:
            "Unlike static segments, dynamic segments need actual parameter values",
        },

        // DEBUG INFO
        signal_values_during_update: {
          tabSignal: tabSignal.value,
          lonSignal: lonSignal.value,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("map style signal change", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        // Simulate real browser integration: update routes to reflect new URL
        updateRoutes(url);
      },
    });

    try {
      const mapStyleSignal = stateSignal("street");
      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?style=${mapStyleSignal}`,
      });

      updateRoutes(`${baseUrl}/map`);
      mapStyleSignal.value = "satellite";
      const afterUpdateToSattelite = {
        current_url: MAP_ROUTE.url,
        map_style_signal: mapStyleSignal.value,
        navToCalls: [...navToCalls],
      };
      navToCalls.length = 0;
      mapStyleSignal.value = "street";
      const afterRestoreToStreet = {
        current_url: MAP_ROUTE.url,
        map_style_signal: mapStyleSignal.value,
        navToCalls: [...navToCalls],
      };
      return {
        after_update_to_sattelite: afterUpdateToSattelite,
        after_restore_to_street: afterRestoreToStreet,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("map style signal change advanced", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        // Simulate real browser integration: update routes to reflect new URL
        updateRoutes(url);
      },
    });

    try {
      const mapStyleSignal = stateSignal("street");
      const { MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?style=${mapStyleSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone`,
      });

      updateRoutes(`${baseUrl}/map/isochrone`);
      mapStyleSignal.value = "satellite";
      const afterUpdateToSattelite = {
        current_url: MAP_ISOCHRONE_ROUTE.url,
        map_style_signal: mapStyleSignal.value,
        navToCalls: [...navToCalls],
      };
      navToCalls.length = 0;
      mapStyleSignal.value = "street";
      const afterRestoreToStreet = {
        current_url: MAP_ISOCHRONE_ROUTE.url,
        map_style_signal: mapStyleSignal.value,
        navToCalls: [...navToCalls],
      };
      return {
        after_update_to_sattelite: afterUpdateToSattelite,
        after_restore_to_street: afterRestoreToStreet,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("deep signal update", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        // Simulate real browser integration: update routes to reflect new URL
        updateRoutes(url);
      },
    });

    try {
      const zoneSignal = stateSignal(undefined);
      const panelSignal = stateSignal(undefined);
      const sportSignal = stateSignal(false, { type: "boolean" });
      const { MAP_FACILITIES_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}/`,
        MAP_FACILITIES_ROUTE: `/map/facilities?sport=${sportSignal}`,
        MAP_OVERVIEW_ROUTE: "/map/overview",
      });
      updateRoutes(`${baseUrl}/map/facilities?zone=paris`);
      const afterInitialNav = {
        current_url: MAP_FACILITIES_ROUTE.url,
        sport_signal: sportSignal.value,
        navToCalls: [...navToCalls],
      };
      navToCalls.length = 0;
      sportSignal.value = true;
      const afterSportTrue = {
        current_url: MAP_FACILITIES_ROUTE.url,
        sport_signal: sportSignal.value,
        navToCalls: [...navToCalls],
      };
      return {
        after_initial_nav: afterInitialNav,
        after_sport_true: afterSportTrue,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("step parameter should prevent redundant navigation calls", () => {
    const navToCalls = [];
    const routeIntegrationMock = {
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    };
    setRouteIntegration(routeIntegrationMock);

    try {
      const lonSignal = stateSignal(2.3, {
        id: "longitude",
        type: "longitude",
        step: 0.1,
      });
      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?lon=${lonSignal}`,
      });
      updateRoutes(`${baseUrl}/map?lon=2.3`);

      const captureState = () => {
        const navToCopy = [...navToCalls];
        navToCalls.length = 0;
        return {
          lon_signal_value: lonSignal.value,
          route_url: MAP_ROUTE.url,
          navToCalls: navToCopy,
        };
      };
      const results = {};

      // Test 1: Set values that round to the same step - should not trigger navigation
      lonSignal.value = 2.32; // Should round to 2.3 (same as current)
      results["after update signal to 2.32"] = captureState();

      lonSignal.value = 2.28; // Should round to 2.3 (same as current)
      results["after update signal to 2.28"] = captureState();

      // Test 2: Set value that rounds to different step - should trigger navigation
      lonSignal.value = 2.45; // Should round to 2.5 (different)
      results["after update signal to 2.45"] = captureState();

      // Test 3: Set another value that rounds to same new step - should not trigger
      lonSignal.value = 2.53; // Should round to 2.5 (same as current 2.5)
      results["after update signal to 2.53"] = captureState();

      // Test 4: Update URL directly with precise value and see how signal reacts
      updateRoutes(`${baseUrl}/map?lon=2.67`); // Should round signal to 2.7
      results["after update url to 2.67"] = captureState();

      lonSignal.value = 3;
      results["after update signal to 3"] = captureState();

      updateRoutes(`${baseUrl}/map?lon=3.000001`);
      results["after update url to 3.000001"] = captureState();

      return {
        setup: {
          lon_signal_default_value: 2.3,
        },
        results,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  test("array signal - signal to URL direction", () => {
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });

    try {
      const colorsSignal = stateSignal([], {
        id: "colorsArray",
        type: "array",
      });
      const { COLORS_ROUTE } = setupRoutes({
        COLORS_ROUTE: `/colors?colors=${colorsSignal}`,
      });

      const captureState = () => {
        const navCalls = [...navToCalls];
        navToCalls.length = 0;
        return {
          signal_value: JSON.parse(JSON.stringify(colorsSignal.value)),
          route_matching: COLORS_ROUTE.matching,
          nav_calls: navCalls,
        };
      };

      const results = {};

      // Step 1: Navigate to page without any params - check signal values
      updateRoutes(`${baseUrl}/colors`);
      results["1_nav_to_colors_no_params"] = captureState();

      // Step 2: Update signal to one value - check navToUrl
      colorsSignal.value = ["red"];
      results["2_signal_one_value"] = captureState();

      // Step 3: Update signal to two values - check navToUrl
      colorsSignal.value = ["red", "blue"];
      results["3_signal_two_values"] = captureState();

      // Step 4: Back to one value - check navToUrl
      colorsSignal.value = ["green"];
      results["4_signal_back_to_one"] = captureState();

      // Step 5: Back to zero values - check navToUrl
      colorsSignal.value = [];
      results["5_signal_back_to_zero"] = captureState();

      return results;
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });

  /*
  test("array signal - URL to signal direction", () => {
    try {
      const colorsSignal = stateSignal([], {
        id: "colorsArrayReverse",
        type: "array",
      });

      const { COLORS_ROUTE } = setupRoutes({
        COLORS_ROUTE: `/colors?colors=${colorsSignal}`,
      });

      const captureState = () => ({
        signal_value: JSON.parse(JSON.stringify(colorsSignal.value)),
        route_matching: COLORS_ROUTE.matching,
        current_url: "will be set by updateRoutes",
      });

      const results = {};

      // Test reverse direction: update URL with various values and check signal.value stays in sync

      // Empty array case
      updateRoutes(`${baseUrl}/colors?colors=`);
      results["url_empty_array"] = captureState();
      results["url_empty_array"].current_url = `/colors?colors=`;

      // Single value
      updateRoutes(`${baseUrl}/colors?colors=red`);
      results["url_single_value"] = captureState();
      results["url_single_value"].current_url = `/colors?colors=red`;

      // Two values
      updateRoutes(`${baseUrl}/colors?colors=red,blue`);
      results["url_two_values"] = captureState();
      results["url_two_values"].current_url = `/colors?colors=red,blue`;

      // Three values
      updateRoutes(`${baseUrl}/colors?colors=red,blue,green`);
      results["url_three_values"] = captureState();
      results["url_three_values"].current_url = `/colors?colors=red,blue,green`;

      // Back to single value
      updateRoutes(`${baseUrl}/colors?colors=yellow`);
      results["url_back_to_single"] = captureState();
      results["url_back_to_single"].current_url = `/colors?colors=yellow`;

      // No colors param (should result in empty array)
      updateRoutes(`${baseUrl}/colors`);
      results["url_no_param"] = captureState();
      results["url_no_param"].current_url = `/colors`;

      return {
        setup: {
          signal_id: "colorsArrayReverse",
          signal_type: "array",
          initial_signal_value: [],
        },
        results,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("array signal - comma handling", () => {
    try {
      const itemsSignal = stateSignal([], {
        id: "itemsWithCommas",
        type: "array",
      });

      const { ITEMS_ROUTE } = setupRoutes({
        ITEMS_ROUTE: `/items?items=${itemsSignal}`,
      });

      const navToCalls = [];
      const routeIntegrationMock = {
        navTo: (url) => {
          navToCalls.push(url);
          updateRoutes(url);
          return Promise.resolve();
        },
      };
      setRouteIntegration(routeIntegrationMock);

      const captureState = () => ({
        signal_value: JSON.parse(JSON.stringify(itemsSignal.value)),
        route_matching: ITEMS_ROUTE.matching,
        nav_to_url: ITEMS_ROUTE.navToUrl(),
        last_nav_call: navToCalls[navToCalls.length - 1] || null,
      });

      const results = {};

      // Test signal with comma value → URL
      itemsSignal.value = ["item1", "item,with,commas", "item3"];
      results["signal_to_url_with_commas"] = captureState();

      // Test URL with comma → signal (the reverse direction)
      updateRoutes(
        `${baseUrl}/items?items=simple,item%2Cwith%2Ccommas,another`,
      );
      results["url_to_signal_with_commas"] = captureState();
      results["url_to_signal_with_commas"].parsed_url =
        `/items?items=simple,item%2Cwith%2Ccommas,another`;

      // Test edge case: value that is just a comma
      itemsSignal.value = ["before", ",", "after"];
      results["signal_pure_comma"] = captureState();

      // Test edge case: value with multiple commas
      itemsSignal.value = ["alpha", "beta,gamma,delta", "omega"];
      results["signal_multiple_commas"] = captureState();

      return {
        setup: {
          signal_id: "itemsWithCommas",
          signal_type: "array",
          test_focus: "comma_handling",
        },
        results,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
      setRouteIntegration(null);
    }
  });
  */
});
