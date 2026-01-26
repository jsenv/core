# [signal updates in child route (isochrone) with parent-child relationship](../../route_url_sync.test.js)

```js
try {
  const walkEnabledSignal = stateSignal(false, {
    id: "enabled",
    type: "boolean",
  });
  const walkMinuteSignal = stateSignal(30, {
    id: "minute",
    type: "number",
  });
  const zoneSignal = stateSignal("paris", {
    id: "zone",
    type: "string",
  });
  const isochroneTabSignal = stateSignal("compare", {
    id: "isochroneTab",
    type: "string",
  });
  const isochroneLongitudeSignal = stateSignal(2.3522, {
    id: "isochroneLongitude",
    type: "number",
  });
  const mapPanelSignal = stateSignal(undefined, {
    id: "odt_map_panel",
    type: "string",
    oneOf: [undefined, "isochrone"],
  });
  mapPanelSignal.value = "isochrone";
  isochroneLongitudeSignal.value = 10;
  zoneSignal.value = "nice";
  const { MAP_ROUTE, ISOCHRONE_ROUTE, ISOCHRONE_COMPARE_ROUTE } =
    setupRoutes({
      HOME_ROUTE: "/",
      MAP_ROUTE: `/map/?zone=${zoneSignal}`,
      MAP_PANEL_ROUTE: `/map/:panel=${mapPanelSignal}/`,
      ISOCHRONE_ROUTE: `/map/isochrone/:tab=${isochroneTabSignal}/?iso_lon=${isochroneLongitudeSignal}`,
      ISOCHRONE_COMPARE_ROUTE: `/map/isochrone/compare?walk=${walkEnabledSignal}&walk_minute=${walkMinuteSignal}`,
      MAP_ISOCHRONE_TIME_ROUTE: "/map/isochrone/time/",
      MAP_ISOCHRONE_TIME_WALK_ROUTE: "/map/isochrone/time/walk",
    });
  updateRoutes(`${baseUrl}/map/isochrone/compare?zone=nice&iso_lon=10`);

  // Mock redirectTo methods to track which routes get redirected during signal updates
  const redirectCalls = [];
  const originalMapRedirectTo = MAP_ROUTE.redirectTo;
  const originalIsochroneRedirectTo = ISOCHRONE_ROUTE.redirectTo;
  const originalIsochroneCompareRedirectTo =
    ISOCHRONE_COMPARE_ROUTE.redirectTo;

  MAP_ROUTE.redirectTo = (params) => {
    redirectCalls.push({
      route: "MAP_ROUTE",
      params,
      url: MAP_ROUTE.buildUrl(params),
    });
    return originalMapRedirectTo.call(MAP_ROUTE, params);
  };

  ISOCHRONE_ROUTE.redirectTo = (params) => {
    redirectCalls.push({
      route: "ISOCHRONE_ROUTE",
      params,
      url: ISOCHRONE_ROUTE.buildUrl(params),
    });
    return originalIsochroneRedirectTo.call(ISOCHRONE_ROUTE, params);
  };

  ISOCHRONE_COMPARE_ROUTE.redirectTo = (params) => {
    redirectCalls.push({
      route: "ISOCHRONE_COMPARE_ROUTE",
      params,
      url: ISOCHRONE_COMPARE_ROUTE.buildUrl(params),
    });
    return originalIsochroneCompareRedirectTo.call(
      ISOCHRONE_COMPARE_ROUTE,
      params,
    );
  };

  const scenario1 = {
    description: "Initial state on isochrone compare route with defaults",
    enabled_signal: walkEnabledSignal.value,
    minute_signal: walkMinuteSignal.value,
    map_route_matches: MAP_ROUTE.matching,
    isochrone_route_matches: ISOCHRONE_ROUTE.matching,
    isochrone_compare_route_matches: ISOCHRONE_COMPARE_ROUTE.matching,
    current_url: ISOCHRONE_COMPARE_ROUTE.url,
  };

  // Clear redirect history before testing signal updates
  redirectCalls.length = 0;

  // Update enabled signal to true (non-default)
  walkEnabledSignal.value = true;

  const scenario2 = {
    description: "After updating enabled signal to true (non-default)",
    enabled_signal: walkEnabledSignal.value,
    minute_signal: walkMinuteSignal.value,
    current_url: ISOCHRONE_COMPARE_ROUTE.url,
    redirect_calls: [...redirectCalls], // Capture redirects from this signal update
  };

  // Clear redirect history
  redirectCalls.length = 0;

  // Update minute signal
  walkMinuteSignal.value = 45;

  const scenario3 = {
    description: "After updating minute signal to 45",
    enabled_signal: walkEnabledSignal.value,
    minute_signal: walkMinuteSignal.value,
    current_url: ISOCHRONE_COMPARE_ROUTE.url,
    redirect_calls: [...redirectCalls], // Capture redirects from this signal update
  };

  // Clear redirect history
  redirectCalls.length = 0;

  // Update enabled back to false (default)
  walkEnabledSignal.value = false;

  const scenario4 = {
    description: "After setting enabled back to false (default)",
    enabled_signal: walkEnabledSignal.value,
    minute_signal: walkMinuteSignal.value,
    current_url: ISOCHRONE_COMPARE_ROUTE.url,
    redirect_calls: [...redirectCalls], // Capture redirects from this signal update
  };

  // Clear redirect history
  redirectCalls.length = 0;

  // Update minute signal again
  walkMinuteSignal.value = 60;

  const scenario5 = {
    description: "After updating minute signal to 60",
    enabled_signal: walkEnabledSignal.value,
    minute_signal: walkMinuteSignal.value,
    current_url: ISOCHRONE_COMPARE_ROUTE.url,
    redirect_calls: [...redirectCalls], // Capture redirects from this signal update
  };

  // Restore original redirectTo methods
  MAP_ROUTE.redirectTo = originalMapRedirectTo;
  ISOCHRONE_ROUTE.redirectTo = originalIsochroneRedirectTo;
  ISOCHRONE_COMPARE_ROUTE.redirectTo = originalIsochroneCompareRedirectTo;

  return {
    scenario1_initial_defaults: scenario1,
    scenario2_enabled_true: scenario2,
    scenario3_minute_45: scenario3,
    scenario4_enabled_false: scenario4,
    scenario5_minute_60: scenario5,

    // Track URL evolution as signals change
    url_progression: [
      scenario1.current_url,
      scenario2.current_url,
      scenario3.current_url,
      scenario4.current_url,
      scenario5.current_url,
    ],

    // Track which routes were redirected for each signal update
    redirect_tracking: {
      enabled_true_redirects: scenario2.redirect_calls,
      minute_45_redirects: scenario3.redirect_calls,
      enabled_false_redirects: scenario4.redirect_calls,
      minute_60_redirects: scenario5.redirect_calls,
    },

    // Analysis of redirect behavior
    redirect_analysis: {
      total_signal_updates: 4,
      routes_that_redirected: {
        MAP_ROUTE: [
          ...scenario2.redirect_calls.filter(
            (c) => c.route === "MAP_ROUTE",
          ),
          ...scenario3.redirect_calls.filter(
            (c) => c.route === "MAP_ROUTE",
          ),
          ...scenario4.redirect_calls.filter(
            (c) => c.route === "MAP_ROUTE",
          ),
          ...scenario5.redirect_calls.filter(
            (c) => c.route === "MAP_ROUTE",
          ),
        ].length,
        ISOCHRONE_ROUTE: [
          ...scenario2.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_ROUTE",
          ),
          ...scenario3.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_ROUTE",
          ),
          ...scenario4.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_ROUTE",
          ),
          ...scenario5.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_ROUTE",
          ),
        ].length,
        ISOCHRONE_COMPARE_ROUTE: [
          ...scenario2.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_COMPARE_ROUTE",
          ),
          ...scenario3.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_COMPARE_ROUTE",
          ),
          ...scenario4.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_COMPARE_ROUTE",
          ),
          ...scenario5.redirect_calls.filter(
            (c) => c.route === "ISOCHRONE_COMPARE_ROUTE",
          ),
        ].length,
      },
    },

    // Test purpose
    test_focus:
      "Signal updates should trigger redirects on the correct routes",
    route_under_test:
      "ISOCHRONE_COMPARE_ROUTE with query parameters and redirect tracking",
  };
} finally {
  clearAllRoutes();
  globalSignalRegistry.clear();
}
```

```js
{
  "scenario1_initial_defaults": {
    "description": "Initial state on isochrone compare route with defaults",
    "enabled_signal": false,
    "minute_signal": 30,
    "map_route_matches": true,
    "isochrone_route_matches": true,
    "isochrone_compare_route_matches": true,
    "current_url": "http://127.0.0.1/map/isochrone?zone=nice"
  },
  "scenario2_enabled_true": {
    "description": "After updating enabled signal to true (non-default)",
    "enabled_signal": true,
    "minute_signal": 30,
    "current_url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk",
    "redirect_calls": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk": true
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk"
      }
    ]
  },
  "scenario3_minute_45": {
    "description": "After updating minute signal to 45",
    "enabled_signal": true,
    "minute_signal": 45,
    "current_url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45",
    "redirect_calls": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 45
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45"
      },
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk": true
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45"
      }
    ]
  },
  "scenario4_enabled_false": {
    "description": "After setting enabled back to false (default)",
    "enabled_signal": false,
    "minute_signal": 45,
    "current_url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=45",
    "redirect_calls": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 45
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=45"
      }
    ]
  },
  "scenario5_minute_60": {
    "description": "After updating minute signal to 60",
    "enabled_signal": false,
    "minute_signal": 60,
    "current_url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=60",
    "redirect_calls": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 60
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=60"
      }
    ]
  },
  "url_progression": [
    "http://127.0.0.1/map/isochrone?zone=nice",
    "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk",
    "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45",
    "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=45",
    "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=60"
  ],
  "redirect_tracking": {
    "enabled_true_redirects": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk": true
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk"
      }
    ],
    "minute_45_redirects": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 45
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45"
      },
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk": true
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk&walk_minute=45"
      }
    ],
    "enabled_false_redirects": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 45
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=45"
      }
    ],
    "minute_60_redirects": [
      {
        "route": "ISOCHRONE_COMPARE_ROUTE",
        "params": {
          "walk_minute": 60
        },
        "url": "http://127.0.0.1/map/isochrone/compare?zone=nice&iso_lon=10&walk_minute=60"
      }
    ]
  },
  "redirect_analysis": {
    "total_signal_updates": 4,
    "routes_that_redirected": {
      "MAP_ROUTE": 0,
      "ISOCHRONE_ROUTE": 0,
      "ISOCHRONE_COMPARE_ROUTE": 5
    }
  },
  "test_focus": "Signal updates should trigger redirects on the correct routes",
  "route_under_test": "ISOCHRONE_COMPARE_ROUTE with query parameters and redirect tracking"
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
