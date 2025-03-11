import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

const actual = humanize(null);
const expect = "null";
assert({ actual, expect });
