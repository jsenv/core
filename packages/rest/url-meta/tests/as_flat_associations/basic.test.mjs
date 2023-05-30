import { assert } from "@jsenv/assert";

import { asFlatAssociations } from "@jsenv/url-meta/src/as_flat_associations.js";

{
  const actual = asFlatAssociations({
    visible: {
      "file:///a.js": true,
      "file:///b.js": false,
    },
  });
  const expected = {
    "file:///a.js": {
      visible: true,
    },
    "file:///b.js": {
      visible: false,
    },
  };
  assert({ actual, expected });
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
  const expected = {
    "file:///a.js": {
      visible: true,
      whatever: true,
    },
  };
  assert({ actual, expected });
}

try {
  asFlatAssociations("foo");
  throw new Error("shoud crash");
} catch (error) {
  const actual = error;
  const expected = new TypeError(
    `associations must be a plain object, got foo`,
  );
  assert({ actual, expected });
}

{
  const actual = asFlatAssociations({
    visible: "foo",
    whatever: {
      "file:///a.js": true,
    },
  });
  const expected = {
    "file:///a.js": { whatever: true },
  };
  assert({ actual, expected });
}
