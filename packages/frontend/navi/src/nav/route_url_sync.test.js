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

      // Create routes where MAP_ROUTE can match with trailing slash (parent route)
      const { MAP_ROUTE, MAP_ISOCHRONE_COMPARE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/?zoom=${zoomSignal}`, // Trailing slash makes it match child routes
        MAP_ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?zoom=${zoomSignal}`,
      });

      // Simulate being on the child route: /map/isochrone/compare?zoom=10
      updateRoutes(`${baseUrl}/map/isochrone/compare?zoom=10`);

      // Mock redirectTo on both routes to track which one gets called
      const redirectCalls = [];
      const originalMapRedirectTo = MAP_ROUTE.redirectTo;
      const originalCompareRedirectTo = MAP_ISOCHRONE_COMPARE_ROUTE.redirectTo;

      MAP_ROUTE.redirectTo = (params) => {
        redirectCalls.push({
          route: "MAP_ROUTE",
          params,
          url: MAP_ROUTE.buildUrl(params),
        });
        return originalMapRedirectTo.call(MAP_ROUTE, params);
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
      MAP_ISOCHRONE_COMPARE_ROUTE.redirectTo = originalCompareRedirectTo;

      return {
        // Route matching states
        map_matching: MAP_ROUTE.matching,
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

  test("signal updates on parent route should delegate to child route", () => {
    try {
      const zoomSignal = stateSignal(12, {
        id: "hierarchyZoom",
        type: "number",
      });

      const { MAP_ROUTE, MAP_ISOCHRONE_ROUTE, MAP_COMPARE_ROUTE } = setupRoutes(
        {
          MAP_ROUTE: `/map?zoom=${zoomSignal}`,
          MAP_ISOCHRONE_ROUTE: "/map/isochrone",
          MAP_COMPARE_ROUTE: "/map/isochrone/compare",
        },
      );

      // Start on deeply nested route
      updateRoutes(`${baseUrl}/map/isochrone/compare?zoom=15`);

      const redirectCalls = [];

      // Mock all redirectTo methods
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

      // Trigger replaceParams on parent route (this would happen when signal changes)
      // This should delegate to the most specific matching route (MAP_COMPARE_ROUTE)
      MAP_ROUTE.replaceParams({ zoom: 20 });

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

        // Track which route handled the redirect
        redirect_calls: redirectCalls,

        // Verify the most specific route was used
        most_specific_route_used:
          redirectCalls.length > 0 ? redirectCalls[0].route : "none",

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
});
