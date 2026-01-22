import { snapshotTests } from "@jsenv/snapshot";
import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes } from "./route.js";
import { setBaseUrl } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic url building", () => {
    try {
      const { HOME_ROUTE, USER_ROUTE, USER_POSTS_ROUTE } = setupRoutes({
        HOME_ROUTE: "/",
        USER_ROUTE: "/users/:id",
        USER_POSTS_ROUTE: "/users/:id/posts/:postId",
      });

      return {
        home_route: HOME_ROUTE.buildUrl(),
        simple_param: USER_ROUTE.buildUrl({ id: "123" }),
        multiple_params: USER_POSTS_ROUTE.buildUrl({
          id: "123",
          postId: "abc",
        }),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with nested routes inheritance", () => {
    try {
      const sectionSignal = stateSignal("settings", { id: "section" });
      const tabSignal = stateSignal("general", { id: "settings_tab" });
      const analyticsTabSignal = stateSignal("overview", {
        id: "analytics_tab",
      });
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE, ADMIN_ANALYTICS_ROUTE } =
        setupRoutes({
          ROOT: "/",
          ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
          ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
          ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
        });

      return {
        // Test deepest URL generation - should find child routes when possible
        admin_no_params_should_find_settings_with_general_tab:
          ADMIN_ROUTE.buildUrl(),
        admin_explicit_settings: ADMIN_ROUTE.buildUrl({
          section: "settings",
        }),
        admin_explicit_users: ADMIN_ROUTE.buildUrl({
          section: "users",
        }),

        // Settings route URL building - should use deepest route
        settings_should_include_general_tab: ADMIN_SETTINGS_ROUTE.buildUrl(),
        settings_with_security_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security",
        }),
        // Test that providing section param doesn't interfere
        settings_with_section_toto_and_tab: ADMIN_SETTINGS_ROUTE.buildUrl({
          section: "toto",
          tab: "advanced",
        }),
        settings_with_extra_params: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general",
          filter: "active",
        }),

        // Analytics route URL building
        analytics_should_include_overview_tab: ADMIN_ANALYTICS_ROUTE.buildUrl(),
        analytics_with_performance_tab: ADMIN_ANALYTICS_ROUTE.buildUrl({
          tab: "performance",
        }),
        analytics_with_section_toto: ADMIN_ANALYTICS_ROUTE.buildUrl({
          section: "toto",
          tab: "performance",
        }),
        analytics_with_extra_params: ADMIN_ANALYTICS_ROUTE.buildUrl({
          tab: "details",
          dateRange: "7d",
        }),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("url building with local storage mocking", () => {
    // Mock window.localStorage (required by valueInLocalStorage)
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
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      const scenario1 = {
        name: "both_at_defaults",
        localStorage_section: localStorageMock.getItem("section_ls"), // null - cleaned up because value equals default
        localStorage_tab: localStorageMock.getItem("settings_tab_ls"), // null - cleaned up because value equals default
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
        localStorage_section: localStorageMock.getItem("section_ls"), // null - cleaned up because value equals default
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
      clearAllRoutes();
      globalSignalRegistry.clear();
      delete globalThis.window;
    }
  });

  test("parent url updates when child signals change", () => {
    try {
      const sectionSignal = stateSignal("settings", {
        id: "section_reactive",
      });
      const tabSignal = stateSignal("general", {
        id: "settings_tab_reactive",
      });
      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

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
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("explicit params should override signal values", () => {
    try {
      // Match dashboard_demo.jsx scenario: general is the default
      const sectionSignal = stateSignal("settings", {
        id: "param_override_section",
      });
      const tabSignal = stateSignal("general", { id: "param_override_tab" }); // "general" is default
      // Simulate real scenario: tab signal gets changed to "advanced" in localStorage/state
      tabSignal.value = "advanced"; // This simulates what happens in real app

      const { ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      return {
        // Test the exact issue: signal has "advanced" but we explicitly pass "general" (default)
        // This should result in a short URL without the tab parameter
        bug_reproduction_explicit_general: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "general", // Should override signal "advanced" and be omitted as default → "/admin"
        }),

        // Test without any explicit params - should use signal value "advanced"
        using_signal_advanced: ADMIN_SETTINGS_ROUTE.buildUrl({}), // Should use "advanced" from signal

        // Test explicit non-default override
        explicit_security_override: ADMIN_SETTINGS_ROUTE.buildUrl({
          tab: "security", // Should override signal "advanced" with "security"
        }),

        // Test section route behavior
        section_with_default: ADMIN_ROUTE.buildUrl({
          section: "settings", // Should be omitted as default → "/admin"
        }),

        section_with_non_default: ADMIN_ROUTE.buildUrl({
          section: "users", // Should appear → "/admin/users/"
        }),

        // Reference values for debugging
        current_signal_values: {
          section: sectionSignal.value,
          tab: tabSignal.value,
        },
        signal_defaults: {
          section: "settings", // stateSignal first param
          tab: "general", // stateSignal first param
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("root route should not use deepest url generation", () => {
    try {
      // Set up signals with non-default values that would normally trigger deepest URL
      const sectionSignal = stateSignal("settings");
      const tabSignal = stateSignal("general");
      // Change signals to non-default values
      sectionSignal.value = "users";
      tabSignal.value = "advanced";
      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${tabSignal}`,
      });

      return {
        // Root route should ALWAYS stay as "/" even with non-default child signals
        // Users must be able to navigate to home page regardless of app state
        root_with_no_params: ROOT_ROUTE.buildUrl({}),
        root_with_empty_params: ROOT_ROUTE.buildUrl(),

        // For comparison - child routes should use deepest URL when no params provided
        admin_no_params: ADMIN_ROUTE.buildUrl({}), // Should potentially use child route
        admin_settings_no_params: ADMIN_SETTINGS_ROUTE.buildUrl({}), // Should use signal

        // Verify signals have non-default values
        signal_values: {
          section: sectionSignal.value, // "users" (non-default)
          tab: tabSignal.value, // "advanced" (non-default)
        },
        defaults: {
          section: "settings",
          tab: "general",
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("debug deepest url generation", () => {
    try {
      // Simple test case to see what's happening
      const tabSignal = stateSignal("overview", { id: "debug_tab" });
      tabSignal.value = "details"; // non-default
      // Register admin route that should upgrade to analytics when section=analytics
      const { ADMIN_ROUTE, ANALYTICS_ROUTE } = setupRoutes({
        ROOT: "/",
        ADMIN_ROUTE: `/admin/:section/`,
        ANALYTICS_ROUTE: `/admin/analytics?tab=${tabSignal}`,
      });
      return {
        // Test with explicit section=analytics
        admin_with_analytics_section: ADMIN_ROUTE.buildUrl({
          section: "analytics",
        }),
        // Test without params (should use default section which won't match analytics)
        admin_with_no_params: ADMIN_ROUTE.buildUrl({}),

        // For comparison
        analytics_direct: ANALYTICS_ROUTE.buildUrl({}),

        // Signal value
        tab_signal: tabSignal.value,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("deepest url generation with search parameters", () => {
    // Mock localStorage to reproduce the real scenario
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
    globalThis.window = {
      localStorage: localStorageMock,
    };
    try {
      // Set up localStorage with analytics tab having non-default value
      localStorageMock.setItem("section_deepest", "analytics"); // non-default
      localStorageMock.setItem("analytics_tab_deepest", "details"); // non-default
      localStorageMock.setItem("settings_tab_deepest", "general"); // default

      // Create signals with localStorage persistence (like real app)
      const sectionSignal = stateSignal("settings", {
        id: "section_deepest",
        persists: true,
        type: "string",
      });
      const settingsTabSignal = stateSignal("general", {
        id: "settings_tab_deepest",
        persists: true,
        type: "string",
      });
      const analyticsTabSignal = stateSignal("overview", {
        id: "analytics_tab_deepest",
        persists: true,
        type: "string",
      });

      // Register routes like dashboard_demo.jsx:
      // - Admin route with path parameter: /admin/:section/
      // - Analytics route with search parameter: /admin/analytics/?tab=signal
      const { ROOT_ROUTE, ADMIN_ROUTE, ADMIN_ANALYTICS_ROUTE } = setupRoutes({
        ROOT_ROUTE: "/",
        ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
        ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
      });

      return {
        // Reproduce the scenario: on root route, with analytics tab in localStorage
        // This should generate deepest URL including analytics tab from localStorage
        admin_route_from_root: ADMIN_ROUTE.buildUrl({}),

        // For comparison - direct analytics route URL
        analytics_route_direct: ADMIN_ANALYTICS_ROUTE.buildUrl({}),

        // Verify localStorage values
        localStorage_values: {
          section: localStorageMock.getItem("section_deepest"),
          analytics_tab: localStorageMock.getItem("analytics_tab_deepest"),
          settings_tab: localStorageMock.getItem("settings_tab_deepest"),
        },

        // Verify signal values (should reflect localStorage)
        signal_values: {
          section: sectionSignal.value,
          analytics_tab: analyticsTabSignal.value,
          settings_tab: settingsTabSignal.value,
        },

        // Test root route (should not use deepest URL)
        root_route_url: ROOT_ROUTE.buildUrl({}),
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();

      delete globalThis.window;
    }
  });

  test("url building with extra params", () => {
    const sectionSignal = stateSignal("general", { id: "extra_params_tab" });
    const { ADMIN_ROUTE } = setupRoutes({
      ROOT: "/",
      ADMIN_ROUTE: `/admin/:section=${sectionSignal}`,
    });

    return {
      // Extra params should become search parameters
      with_extra_params: ADMIN_ROUTE.buildUrl({
        section: "settings",
        filter: "active",
        page: "2",
      }),
      // extra params (no session given)
      _search_params: ADMIN_ROUTE.buildUrl({
        tab: "users",
        sort: "name",
      }),
    };
  });
});
