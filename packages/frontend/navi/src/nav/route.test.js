import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test.ONLY("route.url should NOT update when unrelated signal changes", () => {
    try {
      const zoneSignal = stateSignal("paris");
      const panelSignal = stateSignal("isochrone");

      const { MAP_ROUTE, MAP_PANEL_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zone=${zoneSignal}`, // Uses zoneSignal only
        MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}?zone=${zoneSignal}`, // Uses both signals
      });

      const mapUrlBefore = MAP_ROUTE.url;

      // Change panelSignal - should NOT affect MAP_ROUTE since it doesn't use panelSignal
      panelSignal.value = "settings";

      const mapUrlAfter = MAP_ROUTE.url;

      return {
        map_url_before: mapUrlBefore,
        map_url_after: mapUrlAfter,
        should_be_same: mapUrlBefore === mapUrlAfter,
        test_result:
          mapUrlBefore === mapUrlAfter
            ? "PASS"
            : "FAIL - MAP_ROUTE affected by panelSignal",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("multiple routes sharing signals should auto-update when signal changes", () => {
    try {
      const zoneSignal = stateSignal("paris", { id: "sharedZone" });
      const panelSignal = stateSignal("isochrone", { id: "panel" });
      const isoLonSignal = stateSignal(2.3522, { id: "isoLon" });

      const { MAP_ROUTE, MAP_PANEL_ROUTE, MAP_ISOCHRONE_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zone=${zoneSignal}`,
        MAP_PANEL_ROUTE: `/map/:panel=${panelSignal}?zone=${zoneSignal}`,
        MAP_ISOCHRONE_ROUTE: `/map/isochrone?zone=${zoneSignal}&iso_lon=${isoLonSignal}`,
      });

      // Read initial URLs for all routes
      const initialUrls = {
        map: MAP_ROUTE.url,
        panel: MAP_PANEL_ROUTE.url,
        isochrone: MAP_ISOCHRONE_ROUTE.url,
      };

      // Change the shared zone signal
      zoneSignal.value = "london";

      // Change other signals
      panelSignal.value = "settings";
      isoLonSignal.value = 0.1278;

      // Read URLs again - all should reflect the new signal values
      const updatedUrls = {
        map: MAP_ROUTE.url,
        panel: MAP_PANEL_ROUTE.url,
        isochrone: MAP_ISOCHRONE_ROUTE.url,
      };

      return {
        initial_signal_values: {
          zone: "paris",
          panel: "isochrone",
          isoLon: 2.3522,
        },
        updated_signal_values: {
          zone: zoneSignal.value,
          panel: panelSignal.value,
          isoLon: isoLonSignal.value,
        },
        initial_urls: initialUrls,
        updated_urls: updatedUrls,
        url_changes: {
          map_changed: initialUrls.map !== updatedUrls.map,
          panel_changed: initialUrls.panel !== updatedUrls.panel,
          isochrone_changed: initialUrls.isochrone !== updatedUrls.isochrone,
        },
        // All URLs should have changed since we modified signals they depend on
        expected_all_changed: true,
        test_results: {
          map: initialUrls.map !== updatedUrls.map ? "PASS" : "FAIL",
          panel: initialUrls.panel !== updatedUrls.panel ? "PASS" : "FAIL",
          isochrone:
            initialUrls.isochrone !== updatedUrls.isochrone ? "PASS" : "FAIL",
        },
        overall_result:
          initialUrls.map !== updatedUrls.map &&
          initialUrls.panel !== updatedUrls.panel &&
          initialUrls.isochrone !== updatedUrls.isochrone
            ? "PASS"
            : "FAIL",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route URL updates should be isolated to relevant signals only", () => {
    try {
      const userIdSignal = stateSignal("123", { id: "userId" });
      const mapZoneSignal = stateSignal("paris", { id: "mapZone" });
      const unrelatedSignal = stateSignal("initial", { id: "unrelated" });

      // Create routes where only some use specific signals
      const { USER_ROUTE, MAP_ROUTE, MIXED_ROUTE } = setupRoutes({
        USER_ROUTE: `/user/:id=${userIdSignal}`, // Only uses userIdSignal
        MAP_ROUTE: `/map?zone=${mapZoneSignal}`, // Only uses mapZoneSignal
        MIXED_ROUTE: `/mixed?user=${userIdSignal}&zone=${mapZoneSignal}`, // Uses both but not unrelated
      });

      // Read initial URLs
      const beforeUrls = {
        user: USER_ROUTE.url,
        map: MAP_ROUTE.url,
        mixed: MIXED_ROUTE.url,
      };

      // Change ONLY the unrelated signal (shouldn't affect any routes)
      unrelatedSignal.value = "changed";

      const afterUnrelatedUrls = {
        user: USER_ROUTE.url,
        map: MAP_ROUTE.url,
        mixed: MIXED_ROUTE.url,
      };

      // Now change userIdSignal (should only affect USER_ROUTE and MIXED_ROUTE)
      userIdSignal.value = "456";

      const afterUserUrls = {
        user: USER_ROUTE.url,
        map: MAP_ROUTE.url,
        mixed: MIXED_ROUTE.url,
      };

      // Finally change mapZoneSignal (should only affect MAP_ROUTE and MIXED_ROUTE)
      mapZoneSignal.value = "london";

      const afterMapUrls = {
        user: USER_ROUTE.url,
        map: MAP_ROUTE.url,
        mixed: MIXED_ROUTE.url,
      };

      return {
        signal_values: {
          initial: { userId: "123", mapZone: "paris", unrelated: "initial" },
          after_unrelated: {
            userId: userIdSignal.value,
            mapZone: mapZoneSignal.value,
            unrelated: unrelatedSignal.value,
          },
          after_user: {
            userId: userIdSignal.value,
            mapZone: mapZoneSignal.value,
            unrelated: unrelatedSignal.value,
          },
          final: {
            userId: userIdSignal.value,
            mapZone: mapZoneSignal.value,
            unrelated: unrelatedSignal.value,
          },
        },
        url_progression: {
          before: beforeUrls,
          after_unrelated_change: afterUnrelatedUrls,
          after_user_change: afterUserUrls,
          after_map_change: afterMapUrls,
        },
        isolation_tests: {
          // No routes should change when unrelated signal changes
          unrelated_signal_isolation: {
            user_unchanged: beforeUrls.user === afterUnrelatedUrls.user,
            map_unchanged: beforeUrls.map === afterUnrelatedUrls.map,
            mixed_unchanged: beforeUrls.mixed === afterUnrelatedUrls.mixed,
            all_isolated:
              beforeUrls.user === afterUnrelatedUrls.user &&
              beforeUrls.map === afterUnrelatedUrls.map &&
              beforeUrls.mixed === afterUnrelatedUrls.mixed,
          },
          // Only user and mixed routes should change when userId changes
          user_signal_selectivity: {
            user_changed: afterUnrelatedUrls.user !== afterUserUrls.user,
            map_unchanged: afterUnrelatedUrls.map === afterUserUrls.map,
            mixed_changed: afterUnrelatedUrls.mixed !== afterUserUrls.mixed,
            selective:
              afterUnrelatedUrls.user !== afterUserUrls.user &&
              afterUnrelatedUrls.map === afterUserUrls.map &&
              afterUnrelatedUrls.mixed !== afterUserUrls.mixed,
          },
          // Only map and mixed routes should change when mapZone changes
          map_signal_selectivity: {
            user_unchanged: afterUserUrls.user === afterMapUrls.user,
            map_changed: afterUserUrls.map !== afterMapUrls.map,
            mixed_changed: afterUserUrls.mixed !== afterMapUrls.mixed,
            selective:
              afterUserUrls.user === afterMapUrls.user &&
              afterUserUrls.map !== afterMapUrls.map &&
              afterUserUrls.mixed !== afterMapUrls.mixed,
          },
        },
        test_results: {
          isolation_from_unrelated:
            beforeUrls.user === afterUnrelatedUrls.user &&
            beforeUrls.map === afterUnrelatedUrls.map &&
            beforeUrls.mixed === afterUnrelatedUrls.mixed,
          selective_user_updates:
            afterUnrelatedUrls.user !== afterUserUrls.user &&
            afterUnrelatedUrls.map === afterUserUrls.map &&
            afterUnrelatedUrls.mixed !== afterUserUrls.mixed,
          selective_map_updates:
            afterUserUrls.user === afterMapUrls.user &&
            afterUserUrls.map !== afterMapUrls.map &&
            afterUserUrls.mixed !== afterMapUrls.mixed,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("buildUrl caching issue with signal changes across multiple calls", () => {
    try {
      const userIdSignal = stateSignal("123", { id: "cachingUserId" });
      const statusSignal = stateSignal("active", { id: "cachingStatus" });

      const { USER_PROFILE_ROUTE } = setupRoutes({
        USER_PROFILE_ROUTE: `/user/:id=${userIdSignal}/profile?status=${statusSignal}`,
      });

      // Read URL multiple times to check consistency
      const firstCall = USER_PROFILE_ROUTE.url;
      const secondCall = USER_PROFILE_ROUTE.url;
      const thirdCall = USER_PROFILE_ROUTE.url;

      // Change signal values
      userIdSignal.value = "456";
      statusSignal.value = "inactive";

      // Read URL again multiple times after signal changes
      const fourthCall = USER_PROFILE_ROUTE.url;
      const fifthCall = USER_PROFILE_ROUTE.url;

      // Change only one signal
      userIdSignal.value = "789";

      const sixthCall = USER_PROFILE_ROUTE.url;

      // Change the other signal
      statusSignal.value = "pending";

      const seventhCall = USER_PROFILE_ROUTE.url;

      return {
        signal_progression: {
          phase1: { userId: "123", status: "active" },
          phase2: { userId: "456", status: "inactive" },
          phase3: { userId: "789", status: "inactive" },
          phase4: { userId: "789", status: "pending" },
        },
        url_calls: {
          first_call: firstCall,
          second_call: secondCall,
          third_call: thirdCall,
          fourth_call: fourthCall,
          fifth_call: fifthCall,
          sixth_call: sixthCall,
          seventh_call: seventhCall,
        },
        consistency_checks: {
          // Multiple calls with same signal values should return identical URLs
          initial_consistency:
            firstCall === secondCall && secondCall === thirdCall,
          post_change_consistency: fourthCall === fifthCall,

          // URLs should change when signals change
          changed_after_both_signals: firstCall !== fourthCall,
          changed_after_userid_only: fifthCall !== sixthCall,
          changed_after_status_only: sixthCall !== seventhCall,

          // Each URL should be unique when signal combinations are unique
          all_phases_unique:
            firstCall !== fourthCall &&
            fourthCall !== sixthCall &&
            sixthCall !== seventhCall,
        },
        potential_caching_issues: {
          // If these fail, it indicates caching problems
          urls_update_with_signals:
            firstCall !== fourthCall && fourthCall !== sixthCall,
          no_stale_cache_on_repeated_calls:
            firstCall === secondCall && fourthCall === fifthCall,
        },
        test_result:
          firstCall === secondCall &&
          secondCall === thirdCall &&
          fourthCall === fifthCall &&
          firstCall !== fourthCall &&
          fourthCall !== sixthCall &&
          sixthCall !== seventhCall
            ? "PASS"
            : "FAIL",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.url should automatically stay in sync when signals change", () => {
    try {
      const zoneSignal = stateSignal("paris", { id: "urlSyncZone" });
      const modeSignal = stateSignal("driving", { id: "urlSyncMode" });

      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zone=${zoneSignal}&mode=${modeSignal}`,
      });

      // Read route.url before changing signals
      const urlBeforeChange = MAP_ROUTE.url;

      // Change signal values
      zoneSignal.value = "london";
      modeSignal.value = "walking";

      // Read route.url after changing signals - should automatically reflect changes
      const urlAfterChange = MAP_ROUTE.url;

      return {
        initial_signal_values: {
          zone: "paris",
          mode: "driving",
        },
        updated_signal_values: {
          zone: zoneSignal.value,
          mode: modeSignal.value,
        },
        url_before_change: urlBeforeChange,
        url_after_change: urlAfterChange,
        url_auto_updated: urlBeforeChange !== urlAfterChange,
        // This should be true if route.url is reactive to signal changes
        expected_auto_update: true,
        test_result:
          urlBeforeChange !== urlAfterChange
            ? "PASS"
            : "FAIL - route.url not reactive",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.url sync with hierarchical routes and shared signals", () => {
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
  });
});
