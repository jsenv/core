import { assert } from "@jsenv/assert";

import { a } from "./a.mjs";

const actual = a;
const expect = "b";
assert({ actual, expect });
