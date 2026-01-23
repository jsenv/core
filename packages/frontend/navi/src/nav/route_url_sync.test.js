import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes, updateRoutes } from "./route.js";
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

      // Mock redirectTo on all routes to track which one gets called
      const redirectCalls = [];
      const originalMapRedirectTo = MAP_ROUTE.redirectTo;
      const originalIsochroneRedirectTo = MAP_ISOCHRONE_ROUTE.redirectTo;
      const originalCompareRedirectTo = MAP_ISOCHRONE_COMPARE_ROUTE.redirectTo;

      MAP_ROUTE.redirectTo = (params) => {
        redirectCalls.push({
          route: "MAP_ROUTE",
          params,
          url: MAP_ROUTE.buildUrl(params),
        });
        return originalMapRedirectTo.call(MAP_ROUTE, params);
      };

      MAP_ISOCHRONE_ROUTE.redirectTo = (params) => {
        redirectCalls.push({
          route: "MAP_ISOCHRONE_ROUTE",
          params,
          url: MAP_ISOCHRONE_ROUTE.buildUrl(params),
        });
        return originalIsochroneRedirectTo.call(MAP_ISOCHRONE_ROUTE, params);
      };

      MAP_ISOCHRONE_COMPARE_ROUTE.redirectTo = (params) => {
        redirectCalls.push({
          route: "MAP_ISOCHRONE_COMPARE_ROUTE",
          params,
          url: MAP_ISOCHRONE_COMPARE_ROUTE.buildUrl(params),
        });
        return originalCompareRedirectTo.call(
          MAP_ISOCHRONE_COMPARE_ROUTE,
          params,
        );
      };

      // This should trigger replaceParams on the parent route (which now matches due to trailing slash)
      // But the redirect should be handled by the most specific child route
      MAP_ROUTE.replaceParams({ zoom: 11 });

      // Restore original methods
      MAP_ROUTE.redirectTo = originalMapRedirectTo;
      MAP_ISOCHRONE_ROUTE.redirectTo = originalIsochroneRedirectTo;
      MAP_ISOCHRONE_COMPARE_ROUTE.redirectTo = originalCompareRedirectTo;

      return {
        // Route matching states
        map_matching: MAP_ROUTE.matching,
        isochrone_matching: MAP_ISOCHRONE_ROUTE.matching,
        compare_matching: MAP_ISOCHRONE_COMPARE_ROUTE.matching,

        // Track which route handled the redirect
        redirect_calls: redirectCalls,

        // Expected: child route should handle its own redirect
        expected_redirect_route: "MAP_ISOCHRONE_COMPARE_ROUTE",
        expected_redirect_url: "/map/isochrone/compare?zoom=11",

        // Actual result
        actual_redirect_route:
          redirectCalls.length > 0 ? redirectCalls[0].route : "none",
        actual_redirect_url:
          redirectCalls.length > 0 ? redirectCalls[0].url : "none",

        // Test result
        test_passes:
          redirectCalls.length > 0 &&
          redirectCalls[0].route === "MAP_ISOCHRONE_COMPARE_ROUTE" &&
          redirectCalls[0].url.includes("/map/isochrone/compare?zoom=11"),
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

      const redirectCalls = [];

      // Mock all redirectTo methods to track which ones get called
      const mockRedirectTo = (routeName, originalRedirectTo) => (params) => {
        const route =
          routeName === "MAP_ROUTE"
            ? MAP_ROUTE
            : routeName === "MAP_ISOCHRONE_ROUTE"
              ? MAP_ISOCHRONE_ROUTE
              : MAP_COMPARE_ROUTE;

        redirectCalls.push({
          route: routeName,
          params,
          generatedUrl: route.buildUrl(params),
        });
        return originalRedirectTo.call(route, params);
      };

      const originalMethods = {
        map: MAP_ROUTE.redirectTo,
        isochrone: MAP_ISOCHRONE_ROUTE.redirectTo,
        compare: MAP_COMPARE_ROUTE.redirectTo,
      };

      MAP_ROUTE.redirectTo = mockRedirectTo("MAP_ROUTE", originalMethods.map);
      MAP_ISOCHRONE_ROUTE.redirectTo = mockRedirectTo(
        "MAP_ISOCHRONE_ROUTE",
        originalMethods.isochrone,
      );
      MAP_COMPARE_ROUTE.redirectTo = mockRedirectTo(
        "MAP_COMPARE_ROUTE",
        originalMethods.compare,
      );

      // When signal changes, this should trigger replaceParams on all matching routes
      // but the actual redirect should happen on the most specific one
      zoomSignal.value = 20;

      // Restore methods
      Object.assign(MAP_ROUTE, { redirectTo: originalMethods.map });
      Object.assign(MAP_ISOCHRONE_ROUTE, {
        redirectTo: originalMethods.isochrone,
      });
      Object.assign(MAP_COMPARE_ROUTE, { redirectTo: originalMethods.compare });

      return {
        // Route matching states
        routes_matching: {
          map: MAP_ROUTE.matching,
          isochrone: MAP_ISOCHRONE_ROUTE.matching,
          compare: MAP_COMPARE_ROUTE.matching,
        },

        // Track which routes handled redirects
        redirect_calls: redirectCalls,

        // Verify only the most specific route was used for redirect
        most_specific_route_used:
          redirectCalls.length > 0
            ? redirectCalls[redirectCalls.length - 1].route
            : "none",

        // Expected: MAP_COMPARE_ROUTE should handle the redirect
        expected_most_specific: "MAP_COMPARE_ROUTE",

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

      const redirectCalls = [];

      // Mock all redirectTo methods to track delegation
      const mockRedirectTo = (routeName, originalRedirectTo) => (params) => {
        const route =
          routeName === "MAP_ROUTE"
            ? MAP_ROUTE
            : routeName === "MAP_PANEL_ROUTE"
              ? MAP_PANEL_ROUTE
              : MAP_ISOCHRONE_ROUTE;

        redirectCalls.push({
          route: routeName,
          params,
          generatedUrl: route.buildUrl(params),
        });
        return originalRedirectTo.call(route, params);
      };

      const originalMethods = {
        map: MAP_ROUTE.redirectTo,
        panel: MAP_PANEL_ROUTE.redirectTo,
        isochrone: MAP_ISOCHRONE_ROUTE.redirectTo,
      };

      MAP_ROUTE.redirectTo = mockRedirectTo("MAP_ROUTE", originalMethods.map);
      MAP_PANEL_ROUTE.redirectTo = mockRedirectTo(
        "MAP_PANEL_ROUTE",
        originalMethods.panel,
      );
      MAP_ISOCHRONE_ROUTE.redirectTo = mockRedirectTo(
        "MAP_ISOCHRONE_ROUTE",
        originalMethods.isochrone,
      );

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

      // Clear redirect calls from navigation
      redirectCalls.length = 0;

      // STEP 3: Update the zoom signal
      // This should stay on /map/, not redirect to /map/isochrone/
      zoomSignal.value = 15;

      // Restore methods
      Object.assign(MAP_ROUTE, { redirectTo: originalMethods.map });
      Object.assign(MAP_PANEL_ROUTE, { redirectTo: originalMethods.panel });
      Object.assign(MAP_ISOCHRONE_ROUTE, {
        redirectTo: originalMethods.isochrone,
      });

      return {
        step1_route_matching: step1State,
        step2_route_matching: step2State,

        // After signal update - should only redirect MAP_ROUTE to stay on /map
        final_redirect_calls: redirectCalls,

        // Expected behavior: Should stay on /map?zoom=15
        expected_redirect_route: "MAP_ROUTE",
        expected_url: "/map?zoom=15",

        // Actual behavior
        actual_redirect_route:
          redirectCalls.length > 0
            ? redirectCalls[redirectCalls.length - 1].route
            : "none",
        actual_url:
          redirectCalls.length > 0
            ? redirectCalls[redirectCalls.length - 1].generatedUrl
            : "none",

        // Problem indicator: If MAP_ISOCHRONE_ROUTE gets called, we have the bug
        bug_reproduced: redirectCalls.some(
          (call) => call.route === "MAP_ISOCHRONE_ROUTE",
        ),
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

      const redirectCalls = [];
      const allRedirectCalls = []; // Track ALL redirects including during navigation

      // Mock all redirectTo methods to track delegation
      const mockRedirectTo = (routeName, originalRedirectTo) => (params) => {
        const route =
          routeName === "MAP_ROUTE"
            ? MAP_ROUTE
            : routeName === "MAP_PANEL_ROUTE"
              ? MAP_PANEL_ROUTE
              : MAP_ISOCHRONE_ROUTE;

        const call = {
          route: routeName,
          params,
          generatedUrl: route.buildUrl(params),
        };

        redirectCalls.push(call);
        allRedirectCalls.push(call);
        return originalRedirectTo.call(route, params);
      };

      const originalMethods = {
        map: MAP_ROUTE.redirectTo,
        panel: MAP_PANEL_ROUTE.redirectTo,
        isochrone: MAP_ISOCHRONE_ROUTE.redirectTo,
      };

      MAP_ROUTE.redirectTo = mockRedirectTo("MAP_ROUTE", originalMethods.map);
      MAP_PANEL_ROUTE.redirectTo = mockRedirectTo(
        "MAP_PANEL_ROUTE",
        originalMethods.panel,
      );
      MAP_ISOCHRONE_ROUTE.redirectTo = mockRedirectTo(
        "MAP_ISOCHRONE_ROUTE",
        originalMethods.isochrone,
      );

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

      // Clear redirect history after navigation
      redirectCalls.length = 0;

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

      // Clear redirect history after navigation
      redirectCalls.length = 0;

      // 3. Update zoom signal - this is where the bug should occur
      // If MAP_PANEL_ROUTE is still matching because panel="isochrone",
      // it might be considered "more specific" and redirect incorrectly
      zoomSignal.value = 25;

      // Restore methods
      Object.assign(MAP_ROUTE, { redirectTo: originalMethods.map });
      Object.assign(MAP_PANEL_ROUTE, { redirectTo: originalMethods.panel });
      Object.assign(MAP_ISOCHRONE_ROUTE, {
        redirectTo: originalMethods.isochrone,
      });

      return {
        after_isochrone_nav: afterIsochrone,
        after_map_nav: afterMap,

        // After signal update
        signal_update_redirects: redirectCalls,

        // Check for the bug: Should the panel route be involved when we're on /map?
        panel_route_incorrectly_called: redirectCalls.some(
          (call) => call.route === "MAP_PANEL_ROUTE",
        ),
        isochrone_route_incorrectly_called: redirectCalls.some(
          (call) => call.route === "MAP_ISOCHRONE_ROUTE",
        ),

        // Expected: Only MAP_ROUTE should redirect to stay on /map
        expected_route: "MAP_ROUTE",
        expected_url_pattern: "/map?zoom=25",

        // Actual
        actual_route:
          redirectCalls.length > 0
            ? redirectCalls[redirectCalls.length - 1].route
            : "none",
        actual_url:
          redirectCalls.length > 0
            ? redirectCalls[redirectCalls.length - 1].generatedUrl
            : "none",

        // Full redirect history for debugging
        all_redirects_during_test: allRedirectCalls,

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
});
