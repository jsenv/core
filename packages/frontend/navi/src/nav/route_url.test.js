import { snapshotTests } from "@jsenv/snapshot";
import { prepareRouteRelativeUrl, rawUrlPart } from "./route_url.js";

const run = (urlPattern, params, options) => {
  return prepareRouteRelativeUrl(urlPattern, params, options);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("optional parts removal", () => {
    return {
      optional_wildcard: run("/api/users/*?"),
      complex_optional_group: run("/map/isochrone{/time/*}?"),
      optional_parameter: run("/users/:id?"),
      optional_curly_parameter: run("/posts/{id}?"),
      multiple_optional_parts: run("/api/users/:id?/posts/*?"),
      optional_group_no_params: run("/map/isochrone{/:time/:duration}?"),
    };
  });

  test("parameter replacement", () => {
    return {
      basic_parameters: run("/users/:id/posts/:postId?", {
        id: "123",
        postId: "456",
      }),
      optional_with_value: run("/users/:id?", {
        id: "123",
      }),
      wildcard_parameter: run("/files/*", {
        0: "documents/readme.txt",
      }),
      optional_group_with_params: run("/map/isochrone{/:time/:duration}?", {
        time: 15,
        duration: "minutes",
      }),
    };
  });

  test("raw url parts", () => {
    return {
      raw_wildcard: run("/files/*", {
        0: rawUrlPart("documents/readme.txt"),
      }),
      raw_with_special_chars: run("/path/*", {
        0: rawUrlPart("special chars & symbols"),
      }),
    };
  });

  test("extra parameters", () => {
    return {
      as_search_params: run("/api/users", {
        page: "2",
        limit: "10",
      }),
      mixed_with_path_params: run("/users/:id", {
        id: "123",
        sort: "name",
        order: "asc",
      }),
      empty_params: run("/api/endpoint", {}),
      undefined_values: run("/api/test", {
        defined: "value",
        // eslint-disable-next-line object-shorthand
        undefined: undefined,
        null: null,
      }),
    };
  });

  test("edge cases", () => {
    return {
      empty_pattern: run(""),
      root_pattern: run("/"),
      no_params: run("/api/users"),
      trailing_wildcard: run("/files/*"),
      multiple_wildcards: run("/*/files/*", {
        0: "folder1",
        1: "file.txt",
      }),
      special_characters: run("/users/:id", {
        id: "user@domain.com",
      }),
    };
  });

  test("complex patterns", () => {
    return {
      nested_optional_groups: run("/api{/v1{/users/:id}?}?", {
        id: "123",
      }),
      mixed_parameter_types: run("/api/:version/{resource}/*?", {
        version: "v1",
        resource: "users",
        0: "search",
      }),
      url_encoding: run("/search/*", {
        0: "query with spaces & symbols",
      }),
    };
  });

  test("string params", () => {
    return {
      basic_search_string: run("/toto", "?test=a&bar=b"),
      search_string_with_existing_params: run(
        "/api/users?existing=value",
        "?test=a&bar=b",
      ),
      empty_search_string: run("/path", ""),
      search_string_without_question: run("/path", "test=a&bar=b"),
      search_string_with_encoded_values: run(
        "/search",
        "?q=hello%20world&type=exact",
      ),
      boolean_query_param: run("/api/data", "?bar"),
      boolean_with_other_params: run("/api/data", "?foo=value&bar&baz=test"),
      multiple_boolean_params: run(
        "/api/data?flag3",
        "?flag1&flag2&param=value",
      ),
    };
  });

  test("map pattern with boolean params", () => {
    return {
      map_with_object_boolean: run("map{/}?*", {
        toto: true,
      }),
      map_with_string_boolean: run("map{/}?*", "?toto"),
      map_no_params: run("map{/}?*"),
    };
  });

  test("map pattern variations", () => {
    const runLocal = (params) => {
      return run("/map{/}?*", params);
    };

    return {
      no_params: runLocal(),
      empty_params: runLocal({}),
      wildcard_only: runLocal({
        0: "layer1/layer2",
      }),
      search_params_only: runLocal({
        zoom: "10",
        center: "paris",
      }),
      wildcard_and_search: runLocal({
        0: "satellite",
        zoom: "15",
        lat: "48.8566",
        lng: "2.3522",
      }),
    };
  });

  test("slash encoding behavior", () => {
    const pathValue = "docs/api/guide.md";

    return {
      // Wildcards preserve slashes (they represent path segments)
      wildcard_slashes: run("/files/*", {
        0: pathValue,
      }),

      // Named parameters encode slashes (they're part of the parameter value)
      named_param_slashes: run("/users/:id", {
        id: "user/with/slashes",
      }),

      // Search parameters encode slashes
      search_param_slashes: run("/api", {
        path: "folder/file.txt",
      }),

      // Mixed: wildcard preserves, search params encode
      mixed_example: run("/files/*", {
        0: pathValue,
        type: "text/plain",
      }),
    };
  });

  test("boolean parameters", () => {
    return {
      single_boolean_true: run("/api/data", {
        flag: true,
      }),
      single_boolean_false: run("/api/data", {
        flag: false,
      }),
      mixed_boolean_and_values: run("/api/data", {
        enabled: true,
        disabled: false,
        name: "test",
        count: 42,
      }),
      multiple_true_booleans: run("/search", {
        exact: true,
        caseSensitive: true,
        regex: true,
      }),
      boolean_with_optional_parts: run("/api{/users}?", {
        admin: true,
      }),
      boolean_with_path_params: run("/users/:id", {
        id: "123",
        active: true,
        verified: false,
      }),
    };
  });

  test("string params with optional parts", () => {
    return {
      string_with_simple_optional: run("/api/users/*?", "?search=test"),
      string_with_complex_optional: run(
        "/map/isochrone{/time/:duration}?",
        "?format=json&debug",
      ),
      string_with_nested_optional: run(
        "/api{/v1{/users}?}?",
        "?include=profile&expand",
      ),
      string_with_wildcard_optional: run(
        "/files{/*}?",
        "?download&compress=true",
      ),
      string_merging_with_existing: run(
        "/search?q=test",
        "?sort=date&highlight",
      ),
    };
  });

  test("mixed parameter scenarios", () => {
    return {
      object_and_path_replacement: run("/users/:id/posts/*", {
        id: "user123",
        0: "latest",
        featured: true,
        draft: false,
      }),
      boolean_overwrites_path_param: run("/api/:enabled", {
        enabled: true,
        debug: true,
      }),
      complex_pattern_with_booleans: run("/search{/:query}?{/filters/*}?", {
        query: "javascript",
        0: "recent",
        exact: true,
        caseSensitive: false,
      }),
      empty_vs_false_boolean: run("/test", {
        empty: "",
        zero: 0,
        false: false,
        true: true,
        // eslint-disable-next-line object-shorthand
        undefined: undefined,
        null: null,
      }),
    };
  });

  test("trailing slash normalization", () => {
    return {
      basic_trailing_slash_removal: run("/dashboard/"),
      parameter_with_trailing_slash: run("/users/:id/", { id: "123" }),
      wildcard_with_trailing_slash: run("/api/*/", { 0: "v1/users" }),
      nested_path_trailing_slash: run("/admin/users/:id/edit/", { id: "456" }),
      optional_param_trailing_slash: run("/posts/:id/:slug?/", { id: "123" }),
      optional_param_with_value_trailing_slash: run("/posts/:id/:slug?/", {
        id: "123",
        slug: "hello-world",
      }),
      root_path_preserved: run("/"),
      multiple_trailing_slashes: run("/path///"),
      complex_optional_with_trailing_slash: run(
        "/map/isochrone{/:time/:duration}?/",
        {
          time: "15",
          duration: "minutes",
        },
      ),
      query_params_with_trailing_slash: run("/search/", { q: "test", page: 1 }),
    };
  });

  test("optional group patterns", () => {
    return {
      // Pattern: /colors{/:color}?
      colors_no_params: run("/colors{/:color}?"),
      colors_with_color: run("/colors{/:color}?", { color: "red" }),
      colors_with_undefined_color: run("/colors{/:color}?", {
        color: undefined,
      }),
      colors_with_empty_color: run("/colors{/:color}?", { color: "" }),
      colors_with_null_color: run("/colors{/:color}?", { color: null }),
    };
  });
});
