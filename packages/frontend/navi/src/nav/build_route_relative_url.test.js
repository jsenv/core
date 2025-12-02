import { snapshotTests } from "@jsenv/snapshot";
import {
  buildRouteRelativeUrl,
  rawUrlPart,
} from "./build_route_relative_url.js";

const run = (urlPattern, params) => {
  return buildRouteRelativeUrl(urlPattern, params).relativeUrl;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("optional parts removal", () => {
    return {
      optional_wildcard: run("/api/users/*?"),
      complex_optional_group: run("/map/isochrone{/time/*}?"),
      optional_parameter: run("/users/:id?"),
      optional_curly_parameter: run("/posts/{id}?"),
      multiple_optional_parts: run("/api/users/:id?/posts/*?"),
      optional_group_no_params: run("/map/isochrone{/time/:duration}?"),
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
      optional_group_with_params: run("/map/isochrone{/time/:duration}?", {
        time: "15",
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
});
