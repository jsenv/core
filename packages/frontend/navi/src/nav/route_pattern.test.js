import { assert } from "@jsenv/assert";
import { createRoutePattern } from "./route_pattern.js";

const baseUrl = "http://localhost:3000";

// Basic pattern matching tests
{
  const pattern = createRoutePattern("/users", baseUrl);

  const result = pattern.applyRoutePattern("http://localhost:3000/users");
  const expect = {};
  assert({ actual: result, expect });
}

{
  const pattern = createRoutePattern("/users/:id", baseUrl);

  const result = pattern.applyRoutePattern("http://localhost:3000/users/123");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

{
  const pattern = createRoutePattern("/api/*", baseUrl);

  const result = pattern.applyRoutePattern(
    "http://localhost:3000/api/v1/users",
  );
  const expect = { 0: "v1/users" };
  assert({ actual: result, expect });
}

// Trailing slash normalization tests
{
  const pattern = createRoutePattern("/dashboard", baseUrl);

  // Should match both with and without trailing slash
  const resultWithSlash = pattern.applyRoutePattern(
    "http://localhost:3000/dashboard/",
  );
  const resultWithoutSlash = pattern.applyRoutePattern(
    "http://localhost:3000/dashboard",
  );
  const expect = {};

  assert({ actual: resultWithSlash, expect });
  assert({ actual: resultWithoutSlash, expect });
}

{
  const pattern = createRoutePattern("/users/:id/", baseUrl);

  // Should match URL without trailing slash
  const result = pattern.applyRoutePattern("http://localhost:3000/users/123");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

{
  const pattern = createRoutePattern("/users/:id", baseUrl);

  // Should match URL with trailing slash
  const result = pattern.applyRoutePattern("http://localhost:3000/users/123/");
  const expect = { id: "123" };
  assert({ actual: result, expect });
}

// Multiple parameters tests
{
  const pattern = createRoutePattern("/users/:userId/posts/:postId", baseUrl);

  const result = pattern.applyRoutePattern(
    "http://localhost:3000/users/123/posts/456",
  );
  const expect = { userId: "123", postId: "456" };
  assert({ actual: result, expect });
}

{
  const pattern = createRoutePattern("/api/*/files/*", baseUrl);

  const result = pattern.applyRoutePattern(
    "http://localhost:3000/api/v1/files/document.pdf",
  );
  const expect = { 0: "v1", 1: "document.pdf" };
  assert({ actual: result, expect });
}

// Non-matching URLs should return null
{
  const pattern = createRoutePattern("/users", baseUrl);

  const result = pattern.applyRoutePattern("http://localhost:3000/posts");
  assert({ actual: result, expect: null });
}

{
  const pattern = createRoutePattern("/users/:id", baseUrl);

  const result = pattern.applyRoutePattern("http://localhost:3000/users");
  assert({ actual: result, expect: null });
}

// URL encoding/decoding tests
{
  const pattern = createRoutePattern("/search/:query", baseUrl);

  const result = pattern.applyRoutePattern(
    "http://localhost:3000/search/hello%20world",
  );
  const expect = { query: "hello world" };
  assert({ actual: result, expect });
}

{
  const pattern = createRoutePattern("/users/:email", baseUrl);

  const result = pattern.applyRoutePattern(
    "http://localhost:3000/users/user%40domain.com",
  );
  const expect = { email: "user@domain.com" };
  assert({ actual: result, expect });
}

// Root path tests
{
  const pattern = createRoutePattern("/", baseUrl);

  const resultRoot = pattern.applyRoutePattern("http://localhost:3000/");
  const expectedRoot = {};
  assert({ actual: resultRoot, expect: expectedRoot });

  const resultEmpty = pattern.applyRoutePattern("http://localhost:3000");
  assert({ actual: resultEmpty, expect: expectedRoot });
}

// Complex patterns with trailing slash normalization
{
  const pattern = createRoutePattern("/admin/users/:id/edit", baseUrl);

  const result1 = pattern.applyRoutePattern(
    "http://localhost:3000/admin/users/123/edit/",
  );
  const result2 = pattern.applyRoutePattern(
    "http://localhost:3000/admin/users/123/edit",
  );
  const expect = { id: "123" };

  assert({ actual: result1, expect });
  assert({ actual: result2, expect });
}

console.log("✅ All route pattern tests passed");
