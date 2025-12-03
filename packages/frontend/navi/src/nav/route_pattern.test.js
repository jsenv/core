import { assert } from "@jsenv/assert";
import { createRoutePattern } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";

const run = (pattern, urlOrRelativeUrl) => {
  const { applyRoutePattern } = createRoutePattern(pattern, baseUrl);
  const url = new URL(urlOrRelativeUrl, baseUrl).href;
  return applyRoutePattern(url);
};

// Basic pattern matching tests
{
  const result = run("/users", "/users");
  const expect = {};
  assert({ actual: result, expect });
}

{
  const result = run("/users/:id", "/users/123");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

{
  const result = run("/api/*", "/api/v1/users");
  const expect = { 0: "v1/users" };
  assert({ actual: result, expect });
}

// Trailing slash normalization tests
{
  // Should match both with and without trailing slash
  const resultWithSlash = run("/dashboard", "/dashboard/");
  const resultWithoutSlash = run("/dashboard", "/dashboard");
  const expect = {};

  assert({ actual: resultWithSlash, expect });
  assert({ actual: resultWithoutSlash, expect });
}

{
  // Should match URL without trailing slash
  const result = run("/users/:id/", "/users/123");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

{
  // Should match URL with trailing slash
  const result = run("/users/:id", "/users/123/");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

// Multiple parameters tests
{
  const result = run("/users/:userId/posts/:postId", "/users/123/posts/456");
  const expect = { userId: "123", postId: "456" };
  assert({ actual: result, expect });
}

{
  const result = run("/api/*/files/*", "/api/v1/files/document.pdf");
  const expect = { 0: "v1", 1: "document.pdf" };
  assert({ actual: result, expect });
}

// Non-matching URLs should return null
{
  const result = run("/users", "/posts");
  assert({ actual: result, expect: null });
}

{
  const result = run("/users/:id", "/users");
  assert({ actual: result, expect: null });
}

// URL encoding/decoding tests
{
  const result = run("/search/:query", "/search/hello%20world");
  const expect = { query: "hello world" };
  assert({ actual: result, expect });
}

{
  const result = run("/users/:email", "/users/user%40domain.com");
  const expect = { email: "user@domain.com" };
  assert({ actual: result, expect });
}

// Root path tests
{
  const resultRoot = run("/", "/");
  const expectedRoot = {};
  assert({ actual: resultRoot, expect: expectedRoot });

  const resultEmpty = run("/", "");
  assert({ actual: resultEmpty, expect: expectedRoot });
}

// Complex patterns with trailing slash normalization
{
  const result1 = run("/admin/users/:id/edit", "/admin/users/123/edit/");
  const result2 = run("/admin/users/:id/edit", "/admin/users/123/edit");
  const expect = { id: "123" };

  assert({ actual: result1, expect });
  assert({ actual: result2, expect });
}

console.log("✅ All route pattern tests passed");
