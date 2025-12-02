import { assert } from "@jsenv/assert";
import {
  buildRouteRelativeUrl,
  rawUrlPart,
} from "./build_route_relative_url.js";

// Test basic optional wildcard removal
{
  const { relativeUrl } = buildRouteRelativeUrl("/api/users/*?");
  assert({
    actual: relativeUrl,
    expect: "/api/users",
  });
}

// Test complex optional group removal
{
  const { relativeUrl } = buildRouteRelativeUrl("/map/isochrone{/time/*}?");
  assert({
    actual: relativeUrl,
    expect: "/map/isochrone",
  });
}

// Test optional parameter removal
{
  const { relativeUrl } = buildRouteRelativeUrl("/users/:id?");
  assert({
    actual: relativeUrl,
    expect: "/users",
  });
}

// Test optional curly brace parameter removal
{
  const { relativeUrl } = buildRouteRelativeUrl("/posts/{id}?");
  assert({
    actual: relativeUrl,
    expect: "/posts",
  });
}

// Test multiple optional parts
{
  const { relativeUrl } = buildRouteRelativeUrl("/api/users/:id?/posts/*?");
  assert({
    actual: relativeUrl,
    expect: "/api/users",
  });
}

// Test with parameters that should be replaced
{
  const { relativeUrl } = buildRouteRelativeUrl("/users/:id/posts/:postId?", {
    id: "123",
    postId: "456",
  });
  assert({
    actual: relativeUrl,
    expect: "/users/123/posts/456",
  });
}

// Test optional part not removed when parameter is provided
{
  const { relativeUrl } = buildRouteRelativeUrl("/users/:id?", {
    id: "123",
  });
  assert({
    actual: relativeUrl,
    expect: "/users/123",
  });
}

// Test wildcard with parameter
{
  const { relativeUrl } = buildRouteRelativeUrl("/files/*", {
    0: "documents/readme.txt",
  });
  assert({
    actual: relativeUrl,
    expect: "/files/documents%2Freadme.txt",
  });
}

// Test rawUrlPart bypass encoding
{
  const { relativeUrl } = buildRouteRelativeUrl("/files/*", {
    0: rawUrlPart("documents/readme.txt"),
  });
  assert({
    actual: relativeUrl,
    expect: "/files/documents/readme.txt",
  });
}

// Test extra parameters as search params
{
  const { relativeUrl } = buildRouteRelativeUrl("/api/users", {
    page: "2",
    limit: "10",
  });
  assert({
    actual: relativeUrl,
    expect: "/api/users?page=2&limit=10",
  });
}

// Test complex case: optional group with parameters
{
  const { relativeUrl } = buildRouteRelativeUrl(
    "/map/isochrone{/time/:duration}?",
    {
      time: "15",
      duration: "minutes",
    },
  );
  assert({
    actual: relativeUrl,
    expect: "/map/isochrone/15/minutes",
  });
}

// Test optional group removal when no matching params
{
  const { relativeUrl } = buildRouteRelativeUrl(
    "/map/isochrone{/time/:duration}?",
  );
  assert({
    actual: relativeUrl,
    expect: "/map/isochrone",
  });
}
