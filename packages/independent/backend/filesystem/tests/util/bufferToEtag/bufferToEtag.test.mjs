import { assert } from "@jsenv/assert";

import { bufferToEtag } from "@jsenv/filesystem";

try {
  bufferToEtag("foo");
  throw new Error("should throw");
} catch (actual) {
  const expect = new TypeError(`buffer expect,got foo`);
  assert({ actual, expect });
}

{
  const actual = bufferToEtag(Buffer.from("hello world"));
  const expect = '"b-Kq5sNclPz7QV2+lfQIuc6R7oRu0"';
  assert({ actual, expect });
}

{
  const actual = bufferToEtag(Buffer.from(""));
  const expect = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  assert({ actual, expect });
}
