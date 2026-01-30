import { snapshotTests } from "@jsenv/snapshot";

import { globalSignalRegistry, stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, setupRoutes, updateRoutes } from "./route.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("route.params with static defaults", () => {
    try {
      const mapLonSignal = stateSignal(undefined, {
        default: -1, // static default only
        type: "number",
      });

      const routes = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?lon=${mapLonSignal}`,
      });

      // Test initial state
      updateRoutes("http://localhost:3000/map");

      const initialState = {
        signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      // Test with URL parameter
      updateRoutes("http://localhost:3000/map?lon=42");

      const withUrlParam = {
        signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      // Test back to no URL parameter
      updateRoutes("http://localhost:3000/map");

      const backToNoParam = {
        signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      return {
        initial_state: initialState,
        with_url_param: withUrlParam,
        back_to_no_param: backToNoParam,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params with dynamic defaults", () => {
    try {
      const zoneSignal = stateSignal(undefined);
      const mapLonSignal = stateSignal(zoneSignal, {
        default: -1, // static fallback
        type: "number",
      });

      const routes = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?lon=${mapLonSignal}`,
      });

      // Test initial state (should use static default)
      updateRoutes("http://localhost:3000/map");

      const initialState = {
        zone_signal_value: zoneSignal.value,
        maplon_signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      // Change dynamic default source
      zoneSignal.value = 5;

      const afterDynamicChange = {
        zone_signal_value: zoneSignal.value,
        maplon_signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      // Test with explicit URL parameter that differs from dynamic default
      updateRoutes("http://localhost:3000/map?lon=10");

      const withUrlParam = {
        zone_signal_value: zoneSignal.value,
        maplon_signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      // Remove URL parameter (should revert to dynamic default)
      updateRoutes("http://localhost:3000/map");

      const backToDynamic = {
        zone_signal_value: zoneSignal.value,
        maplon_signal_value: mapLonSignal.value,
        route_params: routes.MAP_ROUTE.params,
        route_matching: routes.MAP_ROUTE.matching,
      };

      return {
        initial_state_static_default: initialState,
        after_dynamic_default_change: afterDynamicChange,
        with_explicit_url_param: withUrlParam,
        back_to_dynamic_default: backToDynamic,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params with multiple signals and dynamic defaults", () => {
    try {
      const zoneSignal = stateSignal(undefined);
      const mapLonSignal = stateSignal(zoneSignal, {
        default: -1,
        type: "number",
      });
      const mapLatSignal = stateSignal(zoneSignal, {
        default: -2,
        type: "number",
      });

      const routes = setupRoutes({
        HOME_ROUTE: "/",
        MAP_ROUTE: `/map/?lon=${mapLonSignal}&lat=${mapLatSignal}`,
      });

      // Test initial state
      updateRoutes("http://localhost:3000/map");

      const initialState = {
        zone_signal: zoneSignal.value,
        lon_signal: mapLonSignal.value,
        lat_signal: mapLatSignal.value,
        route_params: routes.MAP_ROUTE.params,
      };

      // Change dynamic default source
      zoneSignal.value = 42;

      const afterDynamicChange = {
        zone_signal: zoneSignal.value,
        lon_signal: mapLonSignal.value,
        lat_signal: mapLatSignal.value,
        route_params: routes.MAP_ROUTE.params,
      };

      // Test with partial URL parameters
      updateRoutes("http://localhost:3000/map?lon=100");

      const withPartialUrl = {
        zone_signal: zoneSignal.value,
        lon_signal: mapLonSignal.value,
        lat_signal: mapLatSignal.value,
        route_params: routes.MAP_ROUTE.params,
      };

      // Test with full URL parameters
      updateRoutes("http://localhost:3000/map?lon=200&lat=300");

      const withFullUrl = {
        zone_signal: zoneSignal.value,
        lon_signal: mapLonSignal.value,
        lat_signal: mapLatSignal.value,
        route_params: routes.MAP_ROUTE.params,
      };

      return {
        initial_state: initialState,
        after_dynamic_change: afterDynamicChange,
        with_partial_url: withPartialUrl,
        with_full_url: withFullUrl,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params with path parameters and dynamic defaults", () => {
    try {
      const categorySignal = stateSignal(undefined);
      const pageSignal = stateSignal(categorySignal, {
        default: "home",
        type: "string",
      });

      const routes = setupRoutes({
        ROOT_ROUTE: "/",
        CATEGORY_ROUTE: `/category/:page=${pageSignal}`,
      });

      // Test with static default
      updateRoutes("http://localhost:3000/category/home");

      const staticDefaultState = {
        category_signal: categorySignal.value,
        page_signal: pageSignal.value,
        route_params: routes.CATEGORY_ROUTE.params,
        route_matching: routes.CATEGORY_ROUTE.matching,
      };

      // Test with different path parameter
      updateRoutes("http://localhost:3000/category/products");

      const differentPathState = {
        category_signal: categorySignal.value,
        page_signal: pageSignal.value,
        route_params: routes.CATEGORY_ROUTE.params,
        route_matching: routes.CATEGORY_ROUTE.matching,
      };

      // Change dynamic default
      categorySignal.value = "products";

      const afterDynamicChange = {
        category_signal: categorySignal.value,
        page_signal: pageSignal.value,
        route_params: routes.CATEGORY_ROUTE.params,
        route_matching: routes.CATEGORY_ROUTE.matching,
      };

      // Navigate to URL that matches new dynamic default
      updateRoutes("http://localhost:3000/category/products");

      const matchingDynamicDefault = {
        category_signal: categorySignal.value,
        page_signal: pageSignal.value,
        route_params: routes.CATEGORY_ROUTE.params,
        route_matching: routes.CATEGORY_ROUTE.matching,
      };

      // Navigate to URL that no longer matches dynamic default
      updateRoutes("http://localhost:3000/category/home");

      const nonMatchingOldDefault = {
        category_signal: categorySignal.value,
        page_signal: pageSignal.value,
        route_params: routes.CATEGORY_ROUTE.params,
        route_matching: routes.CATEGORY_ROUTE.matching,
      };

      return {
        static_default_state: staticDefaultState,
        different_path_state: differentPathState,
        after_dynamic_change: afterDynamicChange,
        matching_dynamic_default: matchingDynamicDefault,
        non_matching_old_default: nonMatchingOldDefault,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params with nested dynamic defaults chain", () => {
    try {
      const rootSignal = stateSignal(undefined);
      const middleSignal = stateSignal(rootSignal, {
        default: "middle_default",
      });
      const leafSignal = stateSignal(middleSignal, { default: "leaf_default" });

      const routes = setupRoutes({
        HOME_ROUTE: "/",
        NESTED_ROUTE: `/nested/?root=${rootSignal}&middle=${middleSignal}&leaf=${leafSignal}`,
      });

      // Test initial state (all using static defaults)
      updateRoutes("http://localhost:3000/nested");

      const initialState = {
        root_signal: rootSignal.value,
        middle_signal: middleSignal.value,
        leaf_signal: leafSignal.value,
        route_params: routes.NESTED_ROUTE.params,
      };

      // Change root signal (should cascade)
      rootSignal.value = "root_changed";

      const afterRootChange = {
        root_signal: rootSignal.value,
        middle_signal: middleSignal.value,
        leaf_signal: leafSignal.value,
        route_params: routes.NESTED_ROUTE.params,
      };

      // Change middle signal (should affect only leaf)
      middleSignal.value = "middle_changed";

      const afterMiddleChange = {
        root_signal: rootSignal.value,
        middle_signal: middleSignal.value,
        leaf_signal: leafSignal.value,
        route_params: routes.NESTED_ROUTE.params,
      };

      // Test with URL parameters that override signals
      updateRoutes(
        "http://localhost:3000/nested?root=url_root&middle=url_middle&leaf=url_leaf",
      );

      const withUrlOverrides = {
        root_signal: rootSignal.value,
        middle_signal: middleSignal.value,
        leaf_signal: leafSignal.value,
        route_params: routes.NESTED_ROUTE.params,
      };

      return {
        initial_state: initialState,
        after_root_change: afterRootChange,
        after_middle_change: afterMiddleChange,
        with_url_overrides: withUrlOverrides,
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params comparison between static and dynamic defaults", () => {
    try {
      // Create two similar setups: one with static defaults, one with dynamic

      // Setup 1: Static defaults only
      const staticSignal = stateSignal(undefined, { default: "static_value" });

      // Setup 2: Dynamic defaults
      const sourceSignal = stateSignal(undefined);
      const dynamicSignal = stateSignal(sourceSignal, {
        default: "static_fallback",
      });

      const routes = setupRoutes({
        HOME_ROUTE: "/",
        STATIC_ROUTE: `/static/?param=${staticSignal}`,
        DYNAMIC_ROUTE: `/dynamic/?param=${dynamicSignal}`,
      });

      // Test both routes initially
      updateRoutes("http://localhost:3000/static");
      const staticInitial = {
        signal_value: staticSignal.value,
        route_params: routes.STATIC_ROUTE.params,
      };

      updateRoutes("http://localhost:3000/dynamic");
      const dynamicInitial = {
        source_signal: sourceSignal.value,
        dynamic_signal: dynamicSignal.value,
        route_params: routes.DYNAMIC_ROUTE.params,
      };

      // Change source signal for dynamic case
      sourceSignal.value = "dynamic_value";
      const dynamicAfterChange = {
        source_signal: sourceSignal.value,
        dynamic_signal: dynamicSignal.value,
        route_params: routes.DYNAMIC_ROUTE.params,
      };

      // Test URL building with these different defaults
      const staticUrl = routes.STATIC_ROUTE.buildRelativeUrl({});
      const dynamicUrlBefore = routes.DYNAMIC_ROUTE.buildRelativeUrl({});

      sourceSignal.value = "url_test_value";
      const dynamicUrlAfter = routes.DYNAMIC_ROUTE.buildRelativeUrl({});

      return {
        static_initial: staticInitial,
        dynamic_initial: dynamicInitial,
        dynamic_after_change: dynamicAfterChange,
        url_building: {
          static_url: staticUrl,
          dynamic_url_before_change: dynamicUrlBefore,
          dynamic_url_after_change: dynamicUrlAfter,
        },
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.params with dynamic defaults inheritance bug", () => {
    try {
      // This test reproduces bugs where dynamic defaults are not properly considered:
      // 1. buildChildRouteUrl uses parentOptions.defaultValue instead of current dynamic default
      // 2. shouldUseChildRoute uses static defaultValue instead of dynamic defaults
      // 3. connections.find() could be optimized to use parameterOptions map

      // Create a signal that will be used as dynamic default
      const timeBasedDefaultSignal = stateSignal("morning");

      const modeSignal = stateSignal(timeBasedDefaultSignal, {
        id: "mode",
        type: "string",
        // This creates a dynamic default - when timeBasedDefaultSignal changes,
        // the default value for modeSignal changes too
      });

      const categorySignal = stateSignal("general", {
        id: "category",
        type: "string",
        defaultValue: "general", // Static default for comparison
      });

      // Initially, both signals are at their defaults
      // modeSignal.value should equal timeBasedDefaultSignal.value ("morning")
      // categorySignal.value should equal "general"

      const { CHILD_ROUTE } = setupRoutes({
        PARENT_ROUTE: `/parent/:mode=${modeSignal}&category=${categorySignal}`,
        CHILD_ROUTE: `/parent/child/:tab?`,
      });

      // Test 1: Child route should not inherit parameters that are at their current dynamic defaults
      const childUrlWithDefaults = CHILD_ROUTE.buildUrl({ tab: "settings" });

      // Test 2: Change timeBasedDefaultSignal - this changes the dynamic default for modeSignal
      timeBasedDefaultSignal.value = "afternoon";
      // Now modeSignal should be at its new dynamic default ("afternoon")
      const childUrlAfterDynamicDefaultChange = CHILD_ROUTE.buildUrl({
        tab: "settings",
      });

      // Test 3: Set modeSignal to a custom value (not the dynamic default)
      modeSignal.value = "evening"; // This is not the current dynamic default ("afternoon")
      categorySignal.value = "special"; // This is not the static default ("general")

      const childUrlWithCustomValues = CHILD_ROUTE.buildUrl({
        tab: "settings",
      });

      // Test 4: Set modeSignal back to current dynamic default
      modeSignal.value = "afternoon"; // Back to dynamic default
      const childUrlBackToDynamicDefault = CHILD_ROUTE.buildUrl({
        tab: "settings",
      });

      return {
        timeBasedDefault: timeBasedDefaultSignal.value,
        modeValue: modeSignal.value,
        categoryValue: categorySignal.value,
        childUrlWithDefaults, // BUG: Currently inherits params even when at dynamic defaults
        childUrlAfterDynamicDefaultChange, // BUG: May not properly detect new dynamic default
        childUrlWithCustomValues, // Should include: /parent/child/settings?mode=evening&category=special
        childUrlBackToDynamicDefault, // BUG: Should be clean but may still include mode param
      };
    } finally {
      clearAllRoutes();
      globalSignalRegistry.clear();
    }
  });
});
