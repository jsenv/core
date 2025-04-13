import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.applyAssociations({
    url: "file:///a",
    associations: {
      a: {
        "file:///a/**": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b",
    associations: {
      a: {
        "file:///a/**": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b/c",
    associations: {
      a: {
        "file:///a/**": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/a.js",
    associations: {
      a: {
        "file:///a/**": true,
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
        "file:///a/**": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}
