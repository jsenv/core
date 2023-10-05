import { assert } from "@jsenv/assert";

import { a } from "./a.mjs";

const actual = a;
const expected = "b";
assert({ actual, expected });
