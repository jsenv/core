# [route.url sync with hierarchical routes and shared signals](../../route.test.js)

```js
try {
  const zoneSignal = stateSignal("paris", { id: "hierarchicalZone" });
  const panelSignal = stateSignal("isochrone", { id: "hierarchicalPanel" });
  const isoLonSignal = stateSignal(2.3522, { id: "hierarchicalIsoLon" });

  const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
    MAP_ROUTE: `/map?zone=${zoneSignal}`,
    MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}?zone=${zoneSignal}`,
    MAP_ISOCHRONE_ROUTE: `/map/isochrone?zone=${zoneSignal}&iso_lon=${isoLonSignal}`,
  });

  // Read all route.url values before signal changes
  const beforeUrls = {
    map: MAP_ROUTE.url,
    panel: MAP_PANEL_ROUTE.url,
    isochrone: MAP_ISOCHRONE_ROUTE.url,
  };

  // Change shared zone signal
  zoneSignal.value = "london";

  // Read all route.url values after first signal change
  const afterZoneUrls = {
    map: MAP_ROUTE.url,
    panel: MAP_PANEL_ROUTE.url,
    isochrone: MAP_ISOCHRONE_ROUTE.url,
  };

  // Change panel-specific signal
  panelSignal.value = "settings";

  // Read all route.url values after second signal change
  const afterPanelUrls = {
    map: MAP_ROUTE.url,
    panel: MAP_PANEL_ROUTE.url,
    isochrone: MAP_ISOCHRONE_ROUTE.url,
  };

  // Change isochrone-specific signal
  isoLonSignal.value = 0.1278;

  // Read all route.url values after third signal change
  const afterIsoLonUrls = {
    map: MAP_ROUTE.url,
    panel: MAP_PANEL_ROUTE.url,
    isochrone: MAP_ISOCHRONE_ROUTE.url,
  };

  return {
    signal_changes: {
      zone: { from: "paris", to: "london" },
      panel: { from: "isochrone", to: "settings" },
      isoLon: { from: 2.3522, to: 0.1278 },
    },
    url_progression: {
      before_any_changes: beforeUrls,
      after_zone_change: afterZoneUrls,
      after_panel_change: afterPanelUrls,
      after_isolon_change: afterIsoLonUrls,
    },
    reactivity_tests: {
      // Zone signal should affect MAP_ROUTE and MAP_PANEL_ROUTE and MAP_ISOCHRONE_ROUTE
      zone_affected_map: beforeUrls.map !== afterZoneUrls.map,
      zone_affected_panel: beforeUrls.panel !== afterZoneUrls.panel,
      zone_affected_isochrone:
        beforeUrls.isochrone !== afterZoneUrls.isochrone,

      // Panel signal should only affect MAP_PANEL_ROUTE
      panel_affected_map: afterZoneUrls.map !== afterPanelUrls.map,
      panel_affected_panel: afterZoneUrls.panel !== afterPanelUrls.panel,
      panel_affected_isochrone:
        afterZoneUrls.isochrone !== afterPanelUrls.isochrone,

      // IsoLon signal should only affect MAP_ISOCHRONE_ROUTE
      isolon_affected_map: afterPanelUrls.map !== afterIsoLonUrls.map,
      isolon_affected_panel: afterPanelUrls.panel !== afterIsoLonUrls.panel,
      isolon_affected_isochrone:
        afterPanelUrls.isochrone !== afterIsoLonUrls.isochrone,
    },
    expected_behavior: {
      zone_should_affect_all: true,
      panel_should_affect_only_panel: true,
      isolon_should_affect_only_isochrone: true,
    },
    test_results: {
      zone_reactivity_correct:
        beforeUrls.map !== afterZoneUrls.map &&
        beforeUrls.panel !== afterZoneUrls.panel &&
        beforeUrls.isochrone !== afterZoneUrls.isochrone,
      panel_selectivity_correct:
        afterZoneUrls.map === afterPanelUrls.map &&
        afterZoneUrls.panel !== afterPanelUrls.panel &&
        afterZoneUrls.isochrone === afterPanelUrls.isochrone,
      isolon_selectivity_correct:
        afterPanelUrls.map === afterIsoLonUrls.map &&
        afterPanelUrls.panel === afterIsoLonUrls.panel &&
        afterPanelUrls.isochrone !== afterIsoLonUrls.isochrone,
    },
    overall_result: "checking complex signal reactivity patterns",
  };
} finally {
  clearAllRoutes();
  globalSignalRegistry.clear();
}
```

```js
{
  "signal_changes": {
    "zone": {
      "from": "paris",
      "to": "london"
    },
    "panel": {
      "from": "isochrone",
      "to": "settings"
    },
    "isoLon": {
      "from": 2.3522,
      "to": 0.1278
    }
  },
  "url_progression": {
    "before_any_changes": {
      "map": "http://127.0.0.1/map",
      "panel": "http://127.0.0.1/map",
      "isochrone": "http://127.0.0.1/map"
    },
    "after_zone_change": {
      "map": "http://127.0.0.1/map?zone=london",
      "panel": "http://127.0.0.1/map/isochrone?zone=london",
      "isochrone": "http://127.0.0.1/map?zone=london"
    },
    "after_panel_change": {
      "map": "http://127.0.0.1/map/settings?zone=london",
      "panel": "http://127.0.0.1/map/settings?zone=london",
      "isochrone": "http://127.0.0.1/map?zone=london"
    },
    "after_isolon_change": {
      "map": "http://127.0.0.1/map/settings?zone=london",
      "panel": "http://127.0.0.1/map/settings?zone=london",
      "isochrone": "http://127.0.0.1/map?zone=london&iso_lon=0.1278"
    }
  },
  "reactivity_tests": {
    "zone_affected_map": true,
    "zone_affected_panel": true,
    "zone_affected_isochrone": true,
    "panel_affected_map": true,
    "panel_affected_panel": true,
    "panel_affected_isochrone": false,
    "isolon_affected_map": false,
    "isolon_affected_panel": false,
    "isolon_affected_isochrone": true
  },
  "expected_behavior": {
    "zone_should_affect_all": true,
    "panel_should_affect_only_panel": true,
    "isolon_should_affect_only_isochrone": true
  },
  "test_results": {
    "zone_reactivity_correct": true,
    "panel_selectivity_correct": false,
    "isolon_selectivity_correct": true
  },
  "overall_result": "checking complex signal reactivity patterns"
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
