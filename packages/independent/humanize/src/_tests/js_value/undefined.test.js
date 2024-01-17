import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

const actual = humanize(undefined);
const expected = "undefined";
assert({ actual, expected });
