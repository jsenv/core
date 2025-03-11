import { assert } from "@jsenv/assert";

import { asFlatAssociations } from "@jsenv/url-meta/src/url_meta.js";

{
  const actual = asFlatAssociations({
    visible: {
      "file:///a.js": true,
      "file:///b.js": false,
    },
  });
  const expect = {
    "file:///a.js": {
      visible: true,
    },
    "file:///b.js": {
      visible: false,
    },
  };
  assert({ actual, expect });
}

{
  const actual = asFlatAssociations({
    visible: {
      "file:///a.js": true,
    },
    whatever: {
      "file:///a.js": true,
    },
  });
  const expect = {
    "file:///a.js": {
      visible: true,
      whatever: true,
    },
  };
  assert({ actual, expect });
}

try {
  asFlatAssociations("foo");
  throw new Error("shoud crash");
} catch (error) {
  const actual = error;
  const expect = new TypeError(`associations must be a plain object, got foo`);
  assert({ actual, expect });
}

{
  const actual = asFlatAssociations({
    visible: "foo",
    whatever: {
      "file:///a.js": true,
    },
  });
  const expect = {
    "file:///a.js": { whatever: true },
  };
  assert({ actual, expect });
}
