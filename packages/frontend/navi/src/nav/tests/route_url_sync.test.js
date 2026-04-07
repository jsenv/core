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
import { globalSignalRegistry, stateSignal } from "../../state/state_signal.js";
import { route, setupRoutes } from "../route.js";
import { setBaseUrl } from "../route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("alive signal at dynamic segment position", () => {
    const sectionSignal = stateSignal("settings");
    const tabSignal = stateSignal("general");
    const analyticsTabSignal = stateSignal("overview");
    const ROOT_ROUTE = route(`/`);
    const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}/`);
    const ADMIN_ANALYTICS_ROUTE = route(
      `/admin/analytics?tab=${analyticsTabSignal}`,
    );
    const { clearRoutes } = setupRoutes([
      ROOT_ROUTE,
      ADMIN_ROUTE,
      ADMIN_SETTINGS_ROUTE,
      ADMIN_ANALYTICS_ROUTE,
    ]);

    try {
      analyticsTabSignal.value = "details";
      return {
        admin_url: ADMIN_ROUTE.url,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });
});
