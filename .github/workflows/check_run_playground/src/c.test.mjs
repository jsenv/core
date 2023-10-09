import { assert } from "@jsenv/assert";

import { throwSomething } from "./a.mjs";

const actual = throwSomething();
const expected = undefined;
assert({ actual, expected });
