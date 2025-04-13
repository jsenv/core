import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.applyAssociations({
    url: "file:///a",
    associations: {
      a: {
        "file:///**/a": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a",
    associations: {
      a: {
        "file:///**/a": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///c/b/a",
    associations: {
      a: {
        "file:///**/a": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a.js",
    associations: {
      a: {
        "file:///**/a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}
