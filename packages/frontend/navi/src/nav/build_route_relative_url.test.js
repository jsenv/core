import { assert } from "@jsenv/assert";
import { buildRouteRelativeUrl } from "./build_route_relative_url.js";

const { relativeUrl } = buildRouteRelativeUrl("/map/isochrone{/time/*}?");
assert({
  actual: relativeUrl,
  expect: "/map/isochrone",
});
