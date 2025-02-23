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
  const expect = { whatever: true };
  assert({ actual, expect });
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
  const expect = { whatever: false };
  assert({ actual, expect });
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
  const expect = { whatever: true };
  assert({ actual, expect });
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
  const expect = { whatever: false };
  assert({ actual, expect });
}
