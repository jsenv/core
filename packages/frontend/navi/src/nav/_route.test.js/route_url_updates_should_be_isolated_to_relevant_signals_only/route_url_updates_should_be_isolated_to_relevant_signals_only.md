# [route URL updates should be isolated to relevant signals only](../../route.test.js)

```js
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
```

```js
{
  "signal_values": {
    "initial": {
      "userId": "123",
      "mapZone": "paris",
      "unrelated": "initial"
    },
    "after_unrelated": {
      "userId": "456",
      "mapZone": "london",
      "unrelated": "changed"
    },
    "after_user": {
      "userId": "456",
      "mapZone": "london",
      "unrelated": "changed"
    },
    "final": {
      "userId": "456",
      "mapZone": "london",
      "unrelated": "changed"
    }
  },
  "url_progression": {
    "before": {
      "user": "http://127.0.0.1/user",
      "map": "http://127.0.0.1/map",
      "mixed": "http://127.0.0.1/mixed"
    },
    "after_unrelated_change": {
      "user": "http://127.0.0.1/user",
      "map": "http://127.0.0.1/map",
      "mixed": "http://127.0.0.1/mixed"
    },
    "after_user_change": {
      "user": "http://127.0.0.1/user/456",
      "map": "http://127.0.0.1/map",
      "mixed": "http://127.0.0.1/mixed?user=456"
    },
    "after_map_change": {
      "user": "http://127.0.0.1/user/456",
      "map": "http://127.0.0.1/map?zone=london",
      "mixed": "http://127.0.0.1/mixed?user=456&zone=london"
    }
  },
  "isolation_tests": {
    "unrelated_signal_isolation": {
      "user_unchanged": true,
      "map_unchanged": true,
      "mixed_unchanged": true,
      "all_isolated": true
    },
    "user_signal_selectivity": {
      "user_changed": true,
      "map_unchanged": true,
      "mixed_changed": true,
      "selective": true
    },
    "map_signal_selectivity": {
      "user_unchanged": true,
      "map_changed": true,
      "mixed_changed": true,
      "selective": true
    }
  },
  "test_results": {
    "isolation_from_unrelated": true,
    "selective_user_updates": true,
    "selective_map_updates": true
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
