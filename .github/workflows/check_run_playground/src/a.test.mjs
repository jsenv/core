import { assert } from "@jsenv/assert";

import { a } from "./a.mjs";

const actual = a;
const expect = "a";
assert({ actual, expect });
