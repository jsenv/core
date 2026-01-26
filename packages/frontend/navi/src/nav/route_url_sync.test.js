/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("signal not read when accessing route.url", () => {
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

      // Use public API: setupRoutes
      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/:zone=${trackedSignal}`,
      });

      // Use public API: route.url (this should read signal but doesn't)
      const url = MAP_ROUTE.url;

      return {
        signal_value: "default_zone",
        generated_url: url,
        expected_url: "http://127.0.0.1/map/default_zone",
        signal_access_count: signalAccessCount,
        url_missing_signal_value: !url.includes("default_zone"),
        test_result:
          signalAccessCount === 0 ? "FAIL - Signal never read" : "PASS",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
