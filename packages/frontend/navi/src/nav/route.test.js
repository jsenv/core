import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("route URL should auto-update when signal changes", () => {
    try {
      const zoneSignal = stateSignal("paris", { id: "zone" });
      const modeSignal = stateSignal("driving", { id: "mode" });

      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map?zone=${zoneSignal}&mode=${modeSignal}`,
      });

      // Build initial URL
      const initialUrl = MAP_ROUTE.buildUrl();

      // Change signal values
      zoneSignal.value = "london";
      modeSignal.value = "walking";

      // Build URL again - should reflect new signal values
      const updatedUrl = MAP_ROUTE.buildUrl();

      return {
        initial_signal_values: {
          zone: "paris",
          mode: "driving",
        },
        updated_signal_values: {
          zone: zoneSignal.value,
          mode: modeSignal.value,
        },
        initial_url: initialUrl,
        updated_url: updatedUrl,
        url_changed: initialUrl !== updatedUrl,
        // This should be true if the system is working correctly
        expected_url_changed: true,
        // Test passes if URLs are different (indicating signal changes were reflected)
        test_result: initialUrl !== updatedUrl ? "PASS" : "FAIL",
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

      // Build initial URLs for all routes
      const initialUrls = {
        map: MAP_ROUTE.buildUrl(),
        panel: MAP_PANEL_ROUTE.buildUrl(),
        isochrone: MAP_ISOCHRONE_ROUTE.buildUrl(),
      };

      // Change the shared zone signal
      zoneSignal.value = "london";

      // Change other signals
      panelSignal.value = "settings";
      isoLonSignal.value = 0.1278;

      // Build URLs again - all should reflect the new signal values
      const updatedUrls = {
        map: MAP_ROUTE.buildUrl(),
        panel: MAP_PANEL_ROUTE.buildUrl(),
        isochrone: MAP_ISOCHRONE_ROUTE.buildUrl(),
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

      // Build initial URLs
      const beforeUrls = {
        user: USER_ROUTE.buildUrl(),
        map: MAP_ROUTE.buildUrl(),
        mixed: MIXED_ROUTE.buildUrl(),
      };

      // Change ONLY the unrelated signal (shouldn't affect any routes)
      unrelatedSignal.value = "changed";

      const afterUnrelatedUrls = {
        user: USER_ROUTE.buildUrl(),
        map: MAP_ROUTE.buildUrl(),
        mixed: MIXED_ROUTE.buildUrl(),
      };

      // Now change userIdSignal (should only affect USER_ROUTE and MIXED_ROUTE)
      userIdSignal.value = "456";

      const afterUserUrls = {
        user: USER_ROUTE.buildUrl(),
        map: MAP_ROUTE.buildUrl(),
        mixed: MIXED_ROUTE.buildUrl(),
      };

      // Finally change mapZoneSignal (should only affect MAP_ROUTE and MIXED_ROUTE)
      mapZoneSignal.value = "london";

      const afterMapUrls = {
        user: USER_ROUTE.buildUrl(),
        map: MAP_ROUTE.buildUrl(),
        mixed: MIXED_ROUTE.buildUrl(),
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

      // Build URL multiple times to potentially trigger caching
      const firstCall = USER_PROFILE_ROUTE.buildUrl();
      const secondCall = USER_PROFILE_ROUTE.buildUrl();
      const thirdCall = USER_PROFILE_ROUTE.buildUrl();

      // Change signal values
      userIdSignal.value = "456";
      statusSignal.value = "inactive";

      // Build URL again multiple times after signal changes
      const fourthCall = USER_PROFILE_ROUTE.buildUrl();
      const fifthCall = USER_PROFILE_ROUTE.buildUrl();

      // Change only one signal
      userIdSignal.value = "789";

      const sixthCall = USER_PROFILE_ROUTE.buildUrl();

      // Change the other signal
      statusSignal.value = "pending";

      const seventhCall = USER_PROFILE_ROUTE.buildUrl();

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
});
