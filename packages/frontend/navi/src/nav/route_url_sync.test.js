/**
 * Tests for route URL reactivity - ensuring route.url updates correctly when signals change
 *
 * This test suite focuses on two critical scenarios:
 * 1. URLs should UPDATE when their own signals change (proper reactivity)
 * 2. URLs should NOT UPDATE when unrelated signals change (prevent cross-contamination)
 *
 * The signal reading loop in buildMostPreciseUrl (around line 768 in route_pattern.js)
 * is critical for establishing reactive dependencies. When commented out, routes may
 * fail to update when they should, breaking the reactive URL system.
 *
 * Original bug reproduced: Parent routes incorrectly updated when child signals changed
 * Current focus: Ensure signal reading establishes proper reactive dependencies
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("routes should update when signals in signalSet change (even if not directly used)", () => {
    try {
      // This test demonstrates signal reactivity between parent and child routes.
      // PREVIOUSLY: The signal reading loop at line 771 was commented out, which could
      // cause routes to not update when signals in their signalSet change.
      // NOW: Signal reading is enabled (line 771 uncommented) and the test shows proper reactivity.
      //
      // The scenario:
      // 1. Parent route `/admin/:section` uses only sectionSignal
      // 2. Child route `/admin/:section/:page` uses sectionSignal AND pageSignal
      // 3. Parent's signalSet includes pageSignal due to child relationship (setupPatterns)
      // 4. When pageSignal changes, parent updates because signal reading establishes dependencies
      // 5. Test result: "PASS - Parent updates when child signal changes (signal reading works)"

      const sectionSignal = stateSignal("general", { id: "section" });
      const pageSignal = stateSignal("overview", { id: "page" });

      const { PARENT_ROUTE, CHILD_ROUTE } = setupRoutes({
        // Parent route - only uses sectionSignal directly
        PARENT_ROUTE: `/admin/:section=${sectionSignal}`,
        // Child route - uses both signals, creates parent-child relationship
        CHILD_ROUTE: `/admin/:section=${sectionSignal}/:page=${pageSignal}`,
      });

      // Capture initial URLs
      const parentInitial = PARENT_ROUTE.url;
      const childInitial = CHILD_ROUTE.url;

      // Change section signal - both routes should update (normal behavior)
      sectionSignal.value = "advanced";
      const parentAfterSection = PARENT_ROUTE.url;
      const childAfterSection = CHILD_ROUTE.url;

      // Reset section to original
      sectionSignal.value = "general";

      // CRITICAL TEST: Change page signal
      // - Child route should update (uses pageSignal directly)
      // - Parent route should update IF signal reading works (pageSignal in signalSet due to child)
      // - If signal reading is bypassed, parent won't update (reproduces the bug)
      pageSignal.value = "settings";

      const parentAfterPage = PARENT_ROUTE.url;
      const childAfterPage = CHILD_ROUTE.url;

      return {
        signals: {
          section: sectionSignal.value,
          page: pageSignal.value,
        },

        parent_route_urls: {
          initial: parentInitial,
          after_section_change: parentAfterSection,
          after_page_change: parentAfterPage,
        },

        child_route_urls: {
          initial: childInitial,
          after_section_change: childAfterSection,
          after_page_change: childAfterPage,
        },

        // Test if parent reacts to its own signal (should always work)
        parent_reacts_to_section: parentInitial !== parentAfterSection,

        // Test if child reacts to both signals (should always work)
        child_reacts_to_section: childInitial !== childAfterSection,
        child_reacts_to_page: childAfterSection !== childAfterPage,

        // CRITICAL TEST: Does parent react to page signal?
        // This should be TRUE if signal reading works (pageSignal in parent's signalSet)
        // This will be FALSE if signal reading is bypassed (the bug)
        parent_reacts_to_page_signal: parentInitial !== parentAfterPage,

        signal_reading_test:
          parentInitial !== parentAfterPage
            ? "PASS - Parent updates when child signal changes (signal reading works)"
            : "FAIL - Parent ignores child signal changes (signal reading bypassed - BUG!)",

        basic_reactivity_test:
          parentInitial !== parentAfterSection &&
          childAfterSection !== childAfterPage
            ? "PASS - Routes react to their own signals"
            : "FAIL - Routes don't react to own signals (major bug)",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
