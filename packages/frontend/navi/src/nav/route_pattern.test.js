import { snapshotTests } from "@jsenv/snapshot";
import { createRoutePattern } from "./route_pattern.js";

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

  test("matching with a base url", () => {
    const pattern = "/admin/:section/";
    const baseUrl =
      "http://127.0.0.1:3456/packages/frontend/navi/src/nav/demos/dashboard/dashboard.html";
    const url =
      "http://127.0.0.1:3456/packages/frontend/navi/src/nav/demos/dashboard/admin";
    const { applyOn } = createRoutePattern(pattern, baseUrl);
    const result = applyOn(url);
    return {
      result,
    };
  });
});
