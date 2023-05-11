import { assert } from "@jsenv/assert";

import { bufferToEtag } from "@jsenv/filesystem";

try {
  bufferToEtag("foo");
  throw new Error("should throw");
} catch (actual) {
  const expected = new TypeError(`buffer expected, got foo`);
  assert({ actual, expected });
}

{
  const actual = bufferToEtag(Buffer.from("hello world"));
  const expected = '"b-Kq5sNclPz7QV2+lfQIuc6R7oRu0"';
  assert({ actual, expected });
}

{
  const actual = bufferToEtag(Buffer.from(""));
  const expected = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  assert({ actual, expected });
}
