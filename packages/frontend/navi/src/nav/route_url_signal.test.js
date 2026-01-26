/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { createRoutePattern, setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("route URL generation bypasses signal reading", () => {
    try {
      // Create signal with non-default value
      const zoneSignal = stateSignal("paris");

      // Track if signal value is accessed
      let signalWasRead = false;
      const originalValue = zoneSignal.value;
      Object.defineProperty(zoneSignal, "value", {
        get() {
          signalWasRead = true;
          return originalValue;
        },
        set(newValue) {
          originalValue = newValue;
        },
      });

      // Create route pattern with signal
      const pattern = createRoutePattern(`/map/:zone=${zoneSignal}`);

      // Generate URL - should read signal but doesn't due to optimization
      const url = pattern.buildMostPreciseUrl();

      return {
        signal_value: "paris",
        generated_url: url,
        expected_url: "/map/paris",
        signal_was_read: signalWasRead,
        url_missing_param: !url.includes("paris"),
        test_result: signalWasRead ? "PASS" : "FAIL - Signal bypassed",
      };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("default value filtering bypasses signal inclusion", () => {
    try {
      // Create signal that looks like a default value - this gets filtered out
      const zoneSignal = stateSignal("default_zone");

      // Track signal access
      let signalAccessCount = 0;
      const originalSignal = zoneSignal;
      const trackedSignal = new Proxy(zoneSignal, {
        get(target, prop) {
          if (prop === "value") {
            signalAccessCount++;
          }
          return target[prop];
        },
      });

      // Create route pattern
      const pattern = createRoutePattern(`/map/:zone=${trackedSignal}`);

      // Generate URL - signal gets read but value filtered out as "default"
      const url = pattern.buildMostPreciseUrl();

      return {
        signal_value: "default_zone",
        generated_url: url,
        expected_url: "/map/default_zone",
        signal_access_count: signalAccessCount,
        url_missing_signal_value: !url.includes("default_zone"),
        bug_reproduction:
          url !== "/map/default_zone"
            ? "SUCCESS - Signal value filtered out despite being read"
            : "FAIL - URL generated correctly",
      };
    } finally {
      globalSignalRegistry.clear();
    }
  });
});
