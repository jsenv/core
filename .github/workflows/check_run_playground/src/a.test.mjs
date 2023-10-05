import { assert } from "@jsenv/assert";

import { a } from "./a.mjs";

const actual = a;
const expected = "a";
assert({ actual, expected });
