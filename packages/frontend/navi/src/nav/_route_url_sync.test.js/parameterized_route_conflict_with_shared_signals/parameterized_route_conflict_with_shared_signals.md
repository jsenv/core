# [parameterized route conflict with shared signals](../../route_url_sync.test.js#L315)

```js
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
```

```js
{
  "after_isochrone_nav": {
    "url": "http://127.0.0.1/map/isochrone?zoom=10",
    "signal_values": {
      "zoom": 10,
      "panel": "isochrone"
    },
    "routes": {
      "map": false,
      "panel": true,
      "isochrone": true
    }
  },
  "after_map_nav": {
    "url": "http://127.0.0.1/map?zoom=10",
    "signal_values": {
      "zoom": 10,
      "panel": "isochrone"
    },
    "routes": {
      "map": true,
      "panel": false,
      "isochrone": false
    }
  },
  "signal_update_redirects": [
    {
      "route": "MAP_ROUTE",
      "params": {
        "zoom": 25
      },
      "generatedUrl": "http://127.0.0.1/map/isochrone?zoom=25"
    }
  ],
  "panel_route_incorrectly_called": false,
  "isochrone_route_incorrectly_called": false,
  "expected_route": "MAP_ROUTE",
  "expected_url_pattern": "/map?zoom=25",
  "actual_route": "MAP_ROUTE",
  "actual_url": "http://127.0.0.1/map/isochrone?zoom=25",
  "all_redirects_during_test": [
    {
      "route": "MAP_ROUTE",
      "params": {
        "zoom": 25
      },
      "generatedUrl": "http://127.0.0.1/map/isochrone?zoom=25"
    }
  ],
  "final_signal_values": {
    "zoom": 25,
    "panel": "isochrone"
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
