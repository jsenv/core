import { assert } from "@jsenv/assert";

import { throwSomething } from "./a.mjs";

const actual = throwSomething();
const expect = undefined;
assert({ actual, expect });
