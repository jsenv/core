/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("route.url properly reacts to signal changes with optimization fix", () => {
    try {
      // Create a signal that triggers optimization scenario
      const modeSignal = stateSignal("default", { id: "mode" });

      const { PARENT_ROUTE, CHILD_ROUTE } = setupRoutes({
        // Parent route with NO signals - will optimize to child when child has defaults
        PARENT_ROUTE: `/map/`,
        // Child route WITH signal - optimization target
        CHILD_ROUTE: `/map/:mode=${modeSignal}`,
      });

      // Initially parent optimizes to child since mode is default
      const parentUrlInitial = PARENT_ROUTE.url;
      const childUrlInitial = CHILD_ROUTE.url;

      // Change the mode signal to non-default
      modeSignal.value = "advanced";

      // Get URLs after signal change
      // FIXED: Parent now properly reacts to child signal change due to signal reading
      const parentUrlAfterChange = PARENT_ROUTE.url;
      const childUrlAfterChange = CHILD_ROUTE.url;

      // Test if parent URL changes when child signal changes
      const parentReactsToChildSignal =
        parentUrlInitial !== parentUrlAfterChange;

      return {
        parent_url_initial: parentUrlInitial,
        child_url_initial: childUrlInitial,
        mode_signal_value: modeSignal.value,
        parent_url_after_signal_change: parentUrlAfterChange,
        child_url_after_signal_change: childUrlAfterChange,
        parent_reacts_to_child_signal: parentReactsToChildSignal,
        test_result: parentReactsToChildSignal
          ? "PASS - Parent URL properly reacts to child signal changes"
          : "FAIL - Parent URL does not react to child signal changes (optimization bug still exists)",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
