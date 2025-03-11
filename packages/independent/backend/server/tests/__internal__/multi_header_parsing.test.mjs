import { assert } from "@jsenv/assert";
import { parseSingleHeaderWithAttributes } from "@jsenv/server/src/internal/multiple-header.js";

const actual = parseSingleHeaderWithAttributes(`for=ip; host=host;proto=http`);
const expect = {
  for: "ip",
  host: "host",
  proto: "http",
};
assert({ actual, expect });
