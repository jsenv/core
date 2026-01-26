/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { createRoutePattern, setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("signal not read during URL generation", () => {
    try {
      // Create signal that looks like a default value - this gets filtered out
      const zoneSignal = stateSignal("default_zone");

      // Track signal access
      let signalAccessCount = 0;
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

      // Generate URL - signal should be read but isn't due to optimization
      const url = pattern.buildMostPreciseUrl();

      return {
        signal_value: "default_zone",
        generated_url: url,
        expected_url: "/map/default_zone",
        signal_access_count: signalAccessCount,
        url_missing_signal_value: !url.includes("default_zone"),
        test_result:
          signalAccessCount === 0 ? "FAIL - Signal never read" : "PASS",
      };
    } finally {
      globalSignalRegistry.clear();
    }
  });
});
