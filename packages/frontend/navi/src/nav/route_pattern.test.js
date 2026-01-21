import { snapshotTests } from "@jsenv/snapshot";
import { stateSignal } from "../state/state_signal.js";
import {
  buildUrlFromPattern,
  buildUrlFromPatternWithSegmentFiltering,
  createRoutePattern,
} from "./route_pattern.js";

const baseUrl = "http://localhost:3000";

const run = (pattern, urlOrRelativeUrl) => {
  const { applyOn } = createRoutePattern(pattern, baseUrl);
  const url = new URL(urlOrRelativeUrl, baseUrl).href;
  return applyOn(url);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic pattern matching", () => {
    return {
      exact_match: run("/users", "/users"),
      single_parameter: run("/users/:id", "/users/123"),
      wildcard_parameter: run("/api/*", "/api/v1/users"),
    };
  });

  test("trailing slash normalization", () => {
    return {
      pattern_no_slash_url_with_slash: run("/dashboard", "/dashboard/"),
      pattern_no_slash_url_no_slash: run("/dashboard", "/dashboard"),
      pattern_with_slash_url_no_slash: run("/users/:id/", "/users/123"),
      pattern_no_slash_url_with_slash_param: run("/users/:id", "/users/123/"),
    };
  });

  test("multiple parameters", () => {
    return {
      multiple_named_params: run(
        "/users/:userId/posts/:postId",
        "/users/123/posts/456",
      ),
      multiple_wildcard_params: run(
        "/api/*/files/*",
        "/api/v1/files/document.pdf",
      ),
    };
  });

  test("non-matching patterns", () => {
    return {
      different_path: run("/users", "/posts"),
      missing_parameter: run("/users/:id", "/users"),
    };
  });

  test("url encoding and decoding", () => {
    return {
      encoded_spaces: run("/search/:query", "/search/hello%20world"),
      encoded_email: run("/users/:email", "/users/user%40domain.com"),
    };
  });

  test("root path handling", () => {
    return {
      root_with_slash: run("/", "/"),
      root_empty_string: run("/", ""),
    };
  });

  test("complex patterns with trailing slash", () => {
    return {
      complex_with_trailing_slash: run(
        "/admin/users/:id/edit",
        "/admin/users/123/edit/",
      ),
      complex_without_trailing_slash: run(
        "/admin/users/:id/edit",
        "/admin/users/123/edit",
      ),
    };
  });

  test("search parameters in patterns", () => {
    return {
      // Basic search param mapping
      simple_search_param: run("/search?query=:query", "/search?query=hello"),

      // Renamed search param mapping
      renamed_search_param: run("/users?city=:cityName", "/users?city=paris"),

      // Search params in patterns are optional
      search_params_optional: run("/users?city=:cityName", "/users"),

      // Auto search params (no pattern needed)
      auto_search_params: run("/toto", "/toto?foo=bar"),

      // Pattern search params + extra URL search params
      mixed_search_params: run(
        "/users?city=:cityName",
        "/users?city=paris&extra=value",
      ),

      // Path params + auto search params
      path_and_auto_search: run(
        "/users/:id",
        "/users/123?status=active&role=admin",
      ),
    };
  });

  test("literal segment defaults validation", () => {
    const runWithDefaults = (pattern, urlOrRelativeUrl, literalDefaults) => {
      const { applyOn } = createRoutePattern(pattern, baseUrl, literalDefaults);
      const url = new URL(urlOrRelativeUrl, baseUrl).href;
      return applyOn(url);
    };

    // Create a Map for section parameter with default "settings"
    const sectionDefaults = new Map([["section", "settings"]]);

    return {
      // No defaults - all matches should work (baseline)
      no_defaults_match: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin/analytics",
        new Map(),
      ),

      // With defaults - parameter undefined (using default) should match
      using_default_value: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin",
        sectionDefaults,
      ),

      // With defaults - parameter matches expected default should match
      matching_default_value: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin/settings",
        sectionDefaults,
      ),

      // With defaults - parameter doesn't match expected default should not match
      non_matching_default_value: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin/analytics",
        sectionDefaults,
      ),

      // Complex case with multiple segments and defaults
      multiple_segments_valid: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin/settings/general",
        sectionDefaults,
      ),

      // Multiple defaults
      multiple_defaults_valid: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin",
        new Map([
          ["section", "settings"],
          ["tab", "overview"],
        ]),
      ),

      // Multiple defaults with one matching, one not
      multiple_defaults_partial_match: runWithDefaults(
        "/admin/:section?/:tab?",
        "/admin/settings/invalid",
        new Map([
          ["section", "settings"],
          ["tab", "overview"],
        ]),
      ),
    };
  });

  test("literal segment defaults edge cases", () => {
    const runWithDefaults = (pattern, urlOrRelativeUrl, literalDefaults) => {
      const { applyOn } = createRoutePattern(pattern, baseUrl, literalDefaults);
      const url = new URL(urlOrRelativeUrl, baseUrl).href;
      return applyOn(url);
    };

    return {
      // Empty defaults map should allow all matches
      empty_defaults_map: runWithDefaults(
        "/admin/:section",
        "/admin/anything",
        new Map(),
      ),

      // Parameter not in defaults should be allowed
      unrelated_parameter: runWithDefaults(
        "/users/:id/:action?",
        "/users/123/edit",
        new Map([["section", "settings"]]), // Different parameter
      ),

      // Multiple parameters, only some with defaults
      mixed_parameter_defaults: runWithDefaults(
        "/app/:section/:subsection?/:id?",
        "/app/settings/users/123",
        new Map([["section", "settings"]]), // Only section has default
      ),

      // Default value is empty string
      empty_string_default: runWithDefaults(
        "/search/:query?",
        "/search/",
        new Map([["query", ""]]),
      ),

      // Numeric default values
      numeric_default_match: runWithDefaults(
        "/page/:num?",
        "/page/1",
        new Map([["num", "1"]]),
      ),

      // Numeric default values - non-match
      numeric_default_non_match: runWithDefaults(
        "/page/:num?",
        "/page/2",
        new Map([["num", "1"]]),
      ),
    };
  });

  test("custom signal IDs", () => {
    // Test signal with custom string ID instead of auto-generated numeric ID
    const tabSignal = stateSignal("general", { id: "settings_tab" });
    const categorySignal = stateSignal("products", { id: "main_category" });

    return {
      // Single custom signal ID in path parameter
      custom_id_path_param: run(`/admin/:tab=${tabSignal}`, "/admin/security"),

      // Custom signal ID with default value match
      custom_id_default_match: run(
        `/admin/:tab=${tabSignal}`,
        "/admin/general",
      ),

      // Multiple custom signal IDs
      multiple_custom_ids: run(
        `/shop/:category=${categorySignal}/:tab=${tabSignal}`,
        "/shop/electronics/advanced",
      ),

      // Custom signal ID in search parameter
      custom_id_search_param: run(
        `/dashboard?tab=${tabSignal}`,
        "/dashboard?tab=security",
      ),

      // Mixed auto-generated and custom signal IDs
      mixed_signal_types: (() => {
        const autoSignal = stateSignal("auto_default"); // Auto-generated ID
        return run(
          `/mixed/:custom=${tabSignal}/:auto=${autoSignal}`,
          "/mixed/custom_value/auto_value",
        );
      })(),
    };
  });

  test("matching with a base url", () => {
    const sectionSignal = stateSignal("settings");
    const pattern = `/admin/:section=${sectionSignal}/`;
    const baseUrl =
      "http://127.0.0.1:3456/packages/frontend/navi/src/nav/demos/dashboard/dashboard.html";
    const url =
      "http://127.0.0.1:3456/packages/frontend/navi/src/nav/demos/dashboard/admin";
    // Pass parameter defaults so that :section becomes optional via the signal default
    const parameterDefaults = new Map([["section", sectionSignal.value]]);
    const { applyOn } = createRoutePattern(pattern, baseUrl, parameterDefaults);
    const result = applyOn(url);
    return {
      result,
    };
  });

  test("buildUrlFromPattern with segment filtering", () => {
    // Test case that reproduces the issue where segments were incorrectly omitted
    const pattern = "/admin/settings/:tab";
    const routePattern = createRoutePattern(pattern);

    const params = { tab: "advanced" };
    const parameterDefaults = new Map([["section", "settings"]]);

    const result = buildUrlFromPattern(
      routePattern.pattern,
      params,
      parameterDefaults,
    );

    return {
      pattern,
      parsedPattern: routePattern.pattern,
      params,
      parameterDefaults: Object.fromEntries(parameterDefaults),
      result,
      expectedResult: "/admin/settings/advanced",
    };
  });

  test("buildUrlFromPatternWithSegmentFiltering", () => {
    const pattern = "/admin/settings/:tab";
    const routePattern = createRoutePattern(pattern);

    // Mock segment defaults and connections as would be created during inheritance
    const segmentDefaults = new Map([
      [
        1,
        {
          paramName: "section",
          literalValue: "settings",
          signalDefault: "settings",
        },
      ],
    ]);

    const mockSignal = { value: "settings" };
    const connections = [
      {
        paramName: "section",
        options: { defaultValue: "settings" },
      },
    ];

    // Case 1: With parameters provided - should NOT omit segments
    const resultWithParams = buildUrlFromPatternWithSegmentFiltering(
      routePattern.pattern,
      { tab: "advanced" },
      new Map(),
      { segmentDefaults, connections },
    );

    // Case 2: Without parameters - should omit segments when all are defaults
    const resultWithoutParams = buildUrlFromPatternWithSegmentFiltering(
      routePattern.pattern,
      {},
      new Map(),
      { segmentDefaults, connections },
    );

    return {
      pattern,
      case1_with_params: {
        params: { tab: "advanced" },
        result: resultWithParams,
        expected: "/admin/settings/advanced",
      },
      case2_without_params: {
        params: {},
        result: resultWithoutParams,
        expected: "/admin/:tab", // Should keep param placeholder but omit "settings" segment
      },
      segmentDefaults: Array.from(segmentDefaults.entries()),
      connections: connections.map((c) => ({
        paramName: c.paramName,
        defaultValue: c.options.defaultValue,
      })),
    };
  });

  test("buildUrlFromPatternWithSegmentFiltering - no connection for segmentDefault parameter", () => {
    // This reproduces the specific issue where a segment should NOT be filtered
    // when there's no connection for the parameter in the current route
    const pattern = "/admin/analytics/";
    const routePattern = createRoutePattern(pattern);

    // segmentDefaults exists but connections only has "tab", not "section"
    const segmentDefaults = new Map([
      [
        1,
        {
          paramName: "section",
          literalValue: "analytics",
          signalDefault: "analytics", // Even when they match, shouldn't omit without connection
        },
      ],
    ]);

    const connections = [
      {
        paramName: "tab", // Note: different from segmentDefault paramName
        options: { defaultValue: "overview" },
      },
    ];

    const result = buildUrlFromPatternWithSegmentFiltering(
      routePattern.pattern,
      {}, // No parameters provided
      new Map([["section", "analytics"]]),
      { segmentDefaults, connections },
    );

    return {
      pattern,
      segmentDefaults: Array.from(segmentDefaults.entries()),
      connections: connections.map((c) => ({
        paramName: c.paramName,
        defaultValue: c.options.defaultValue,
      })),
      result,
      expected: "/admin/analytics/", // Should NOT omit "analytics" since no connection for "section"
      issue:
        "segment should not be filtered when no connection exists for the parameter",
    };
  });
});
