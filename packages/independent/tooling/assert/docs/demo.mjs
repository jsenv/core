import { assert } from "@jsenv/assert";

const actual = { foo: false };
const expect = { foo: true };
assert({ actual, expect });
