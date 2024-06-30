import { tokenizeSetCookieHeader } from "@jsenv/assert/src/tokenize_header_value.js";

const test = (value, expect) => {
  const actual = tokenizeSetCookieHeader(value);
  if (JSON.stringify(actual) !== JSON.stringify(expect)) {
    throw new Error(`unexpected parse result on "${value}"`);
  }
};

test("foo=a,bar=b", {
  foo: { value: "a" },
  bar: { value: "b" },
});
