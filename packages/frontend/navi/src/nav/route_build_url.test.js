import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, registerRoute, setBaseUrl } from "./route.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const testBuildUrl = (pattern, params = {}) => {
  const route = registerRoute(pattern);
  const url = route.buildUrl(params);
  clearAllRoutes(); // Only clear routes, not signal registry
  return url;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic url building", () => {
    return {
      home_route: testBuildUrl("/"),
      simple_param: testBuildUrl("/users/:id", { id: "123" }),
      multiple_params: testBuildUrl("/users/:id/posts/:postId", {
        id: "123",
        postId: "abc",
      }),
    };
  });

  test("url building with nested routes inheritance", () => {
    clearAllRoutes();
    const sectionSignal = stateSignal("settings", { id: "section" });
    const tabSignal = stateSignal("general", { id: "settings_tab" });
    const analyticsTabSignal = stateSignal("overview", { id: "analytics_tab" });

    // Register routes with inheritance setup (same as route_matching.test.js)
    registerRoute("/");
    const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = registerRoute(
      `/admin/settings/:tab=${tabSignal}`,
    );
    const ADMIN_ANALYTICS_ROUTE = registerRoute(
      `/admin/analytics/?tab=${analyticsTabSignal}`,
    );

    const buildUrl = (route, params = {}) => {
      return route.buildUrl(params);
    };

    return {
      // Test deepest URL generation - should find child routes when possible
      admin_no_params_should_find_settings_with_general_tab:
        buildUrl(ADMIN_ROUTE),
      admin_explicit_settings: buildUrl(ADMIN_ROUTE, {
        section: "settings",
      }),
      admin_explicit_users: buildUrl(ADMIN_ROUTE, {
        section: "users",
      }),

      // Settings route URL building - should use deepest route
      settings_should_include_general_tab: buildUrl(ADMIN_SETTINGS_ROUTE),
      settings_with_security_tab: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "security",
      }),
      // Test that providing section param doesn't interfere
      settings_with_explicit_section_and_tab: buildUrl(ADMIN_SETTINGS_ROUTE, {
        section: "toto",
        tab: "advanced",
      }),
      settings_with_extra_params: buildUrl(ADMIN_SETTINGS_ROUTE, {
        tab: "general",
        filter: "active",
      }),

      // Analytics route URL building
      analytics_should_include_overview_tab: buildUrl(ADMIN_ANALYTICS_ROUTE),
      analytics_with_performance_tab: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "performance",
      }),
      analytics_with_explicit_section: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        section: "toto",
        tab: "performance",
      }),
      analytics_with_extra_params: buildUrl(ADMIN_ANALYTICS_ROUTE, {
        tab: "details",
        dateRange: "7d",
      }),
    };
  });

  test("url building with local storage mocking", () => {
    clearAllRoutes();
    globalSignalRegistry.clear();

    // Mock window.localStorage (required by valueInLocalStorage)
    const originalWindow = globalThis.window;
    const originalLocalStorage = originalWindow?.localStorage;
    const localStorageMock = {
      storage: new Map(),
      getItem(key) {
        return this.storage.get(key) || null;
      },
      setItem(key, value) {
        this.storage.set(key, String(value));
      },
      removeItem(key) {
        this.storage.delete(key);
      },
      clear() {
        this.storage.clear();
      },
    };

    // Ensure window object exists and has localStorage
    if (!globalThis.window) {
      globalThis.window = {};
    }
    globalThis.window.localStorage = localStorageMock;

    try {
      // Set initial localStorage values
      localStorageMock.setItem("section_ls", "settings"); // default
      localStorageMock.setItem("settings_tab_ls", "general"); // default

      const sectionSignal = stateSignal("settings", {
        id: "section_ls",
        persists: true,
        type: "string",
      });
      const tabSignal = stateSignal("general", {
        id: "settings_tab_ls",
        persists: true,
        type: "string",
      });

      const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
      const ADMIN_SETTINGS_ROUTE = registerRoute(
        `/admin/settings/:tab=${tabSignal}`,
      );

      const scenario1 = {
        name: "both_at_defaults",
        localStorage_section: localStorageMock.getItem("section_ls"),
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"),
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Change localStorage and signal values to non-defaults
      localStorageMock.setItem("section_ls", "users");
      localStorageMock.setItem("settings_tab_ls", "security");
      sectionSignal.value = "users"; // This should trigger localStorage update
      tabSignal.value = "security"; // This should trigger localStorage update

      const scenario2 = {
        name: "both_non_defaults",
        localStorage_section: localStorageMock.getItem("section_ls"),
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"),
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      // Test mixed scenario: section=settings (default), tab=security (non-default)
      localStorageMock.setItem("section_ls", "settings");
      localStorageMock.setItem("settings_tab_ls", "security");
      sectionSignal.value = "settings";
      tabSignal.value = "security";

      const scenario3 = {
        name: "section_default_tab_non_default",
        localStorage_section: localStorageMock.getItem("section_ls"),
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"),
        signal_section: sectionSignal.value,
        signal_tab: tabSignal.value,
        admin_url: ADMIN_ROUTE.buildUrl({}),
        settings_url: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      };

      return {
        scenario1,
        scenario2,
        scenario3,
      };
    } finally {
      // Restore original window and localStorage
      if (originalWindow) {
        globalThis.window = originalWindow;
      } else if (globalThis.window) {
        delete globalThis.window;
      }
    }
  });

  test("signal reactivity - parent url updates when child signals change", () => {
    clearAllRoutes();
    globalSignalRegistry.clear();

    const sectionSignal = stateSignal("settings", { id: "section_reactive" });
    const tabSignal = stateSignal("general", { id: "settings_tab_reactive" });

    const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
    const ADMIN_SETTINGS_ROUTE = registerRoute(
      `/admin/settings/:tab=${tabSignal}`,
    );

    // Capture initial URLs
    const initialUrls = {
      admin_initial: ADMIN_ROUTE.buildUrl({}),
      settings_initial: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      admin_relativeUrl_initial: ADMIN_ROUTE.relativeUrl,
      settings_relativeUrl_initial: ADMIN_SETTINGS_ROUTE.relativeUrl,
    };

    // Change child route signal (tab) - this should make parent route generate deepest URL
    tabSignal.value = "security";

    const afterTabChange = {
      admin_after_tab_change: ADMIN_ROUTE.buildUrl({}),
      settings_after_tab_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      admin_relativeUrl_after_tab: ADMIN_ROUTE.relativeUrl,
      settings_relativeUrl_after_tab: ADMIN_SETTINGS_ROUTE.relativeUrl,
      tab_signal_value: tabSignal.value,
      // Key behavior: Parent route now generates deepest URL because child has non-default value
      parent_now_uses_child_route:
        ADMIN_ROUTE.buildUrl({}) === ADMIN_SETTINGS_ROUTE.buildUrl({}),
    };

    // Change parent route signal (section) - should use parent's own parameter
    sectionSignal.value = "users";

    const afterSectionChange = {
      admin_after_section_change: ADMIN_ROUTE.buildUrl({}),
      settings_after_section_change: ADMIN_SETTINGS_ROUTE.buildUrl({}),
      admin_relativeUrl_after_section: ADMIN_ROUTE.relativeUrl,
      settings_relativeUrl_after_section: ADMIN_SETTINGS_ROUTE.relativeUrl,
      section_signal_value: sectionSignal.value,
      // Parent route uses its own non-default parameter now
      parent_uses_own_param: ADMIN_ROUTE.buildUrl({}).includes("users"),
    };

    return {
      initialUrls,
      afterTabChange,
      afterSectionChange,
    };
  });

  test("url building with extra params", () => {
    clearAllRoutes();
    globalSignalRegistry.clear();
    const tabSignal = stateSignal("general", { id: "extra_params_tab" });

    return {
      // Extra params should become search parameters
      with_extra_params: testBuildUrl(`/admin/:section=${tabSignal}`, {
        section: "settings",
        filter: "active",
        page: "2",
      }),
      // Only extra params
      only_search_params: testBuildUrl("/admin", {
        tab: "users",
        sort: "name",
      }),
    };
  });
});
