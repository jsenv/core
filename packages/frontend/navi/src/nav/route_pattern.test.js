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
});
