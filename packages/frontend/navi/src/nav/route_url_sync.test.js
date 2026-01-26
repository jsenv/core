/**
 * Minimal test demonstrating signal bypassing in route URL generation
 */

import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

setBaseUrl("http://127.0.0.1");

await snapshotTests(import.meta.url, ({ test }) => {
  test("BUG REPRODUCTION: parent route incorrectly uses child signals in URL building", () => {
    try {
      const sectionSignal = stateSignal("general", { id: "section" });
      const pageSignal = stateSignal("overview", { id: "page" });

      const { ADMIN_ROUTE, ADMIN_PAGE_ROUTE } = setupRoutes({
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}`, // Should only use sectionSignal
        ADMIN_PAGE_ROUTE: `/admin/:section=${sectionSignal}/:page=${pageSignal}`, // Uses both signals
      });

      // Get initial URLs
      const adminInitial = ADMIN_ROUTE.url;
      const adminPageInitial = ADMIN_PAGE_ROUTE.url;

      // Change pageSignal - ADMIN_ROUTE should NOT change since it doesn't use pageSignal
      pageSignal.value = "settings";

      const adminAfterPageChange = ADMIN_ROUTE.url;
      const adminPageAfterPageChange = ADMIN_PAGE_ROUTE.url;

      // BUG: ADMIN_ROUTE changes when pageSignal changes, but it shouldn't!
      const adminIncorrectlyChanged = adminInitial !== adminAfterPageChange;

      return {
        section_signal: sectionSignal.value,
        page_signal: pageSignal.value,
        admin_initial: adminInitial,
        admin_page_initial: adminPageInitial,
        admin_after_page_change: adminAfterPageChange,
        admin_page_after_page_change: adminPageAfterPageChange,
        admin_incorrectly_changed: adminIncorrectlyChanged,
        expected_admin_url: "http://127.0.0.1/admin/general", // Should be this
        actual_admin_url: adminAfterPageChange,
        bug_reproduction: adminIncorrectlyChanged
          ? "SUCCESS - Bug reproduced: Parent route uses child signals incorrectly"
          : "FAIL - Bug not reproduced, parent route correctly ignores child signals",
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
