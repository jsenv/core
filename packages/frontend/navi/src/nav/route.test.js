import { assert } from "@jsenv/assert";
import { createRoute } from "./route.js";

const route = createRoute("/map/isochrone{/time/*}?");
const relativeUrl = route.buildRelativeUrl();
assert({ actual: relativeUrl, expected: "/map/isochrone" });
