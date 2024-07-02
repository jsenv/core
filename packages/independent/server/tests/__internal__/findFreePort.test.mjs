import { assert } from "@jsenv/assert";

import { findFreePort } from "@jsenv/server";

const port = await findFreePort();

const actual = typeof port;
const expect = "number";
assert({ actual, expect });
