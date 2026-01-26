/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("route.url auto-updated when signal is updated", () => {
    try {
      const zoneSignal = stateSignal("paris", { id: "zone" });
      const { MAP_ROUTE } = setupRoutes({
        MAP_ROUTE: `/map/:zone=${zoneSignal}`,
      });
      const url = MAP_ROUTE.url;
      zoneSignal.value = "london";
      const urlAfterChange = MAP_ROUTE.url;
      return {
        url,
        url_after_change: urlAfterChange,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
