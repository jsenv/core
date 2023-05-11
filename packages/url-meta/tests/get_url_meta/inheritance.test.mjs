import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: {
      whatever: {
        "file:///**/*": true,
        "file:///.git/": false,
      },
    },
  });
  const expected = { whatever: true };
  assert({ actual, expected });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///.git/file.js",
    associations: {
      whatever: {
        "file:///**/*": true,
        "file:///.git/": false,
      },
    },
  });
  const expected = { whatever: false };
  assert({ actual, expected });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: {
      whatever: {
        "file:///**/*": false,
        "file:///*": true,
      },
    },
  });
  const expected = { whatever: true };
  assert({ actual, expected });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///.git/file.js",
    associations: {
      whatever: {
        "file:///**/*": false,
        "file:///*": true,
      },
    },
  });
  const expected = { whatever: false };
  assert({ actual, expected });
}
