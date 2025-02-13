import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///src/",
    associations: {
      whatever: {
        "file:///**/*": 42,
        "file:///.git/": 43,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  });
  const expect = true;
  assert({ actual, expect });
}

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///.git/",
    associations: {
      whatever: {
        "file:///**/*": 42,
        "file:///.git/": 43,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  });
  const expect = false;
  assert({ actual, expect });
}

try {
  URL_META.urlChildMayMatch({
    url: "file:///.git",
    associations: {
      whatever: {
        "file:///**/*": 42,
        "file:///.git/": 43,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  });
  throw new Error("shoud crash");
} catch (error) {
  const actual = error;
  const expect = new Error(`url should end with /, got file:///.git`);
  assert({ actual, expect });
}

try {
  URL_META.urlChildMayMatch({
    url: "file:///.git/",
    associations: {
      whatever: {
        "file:///**/*": 42,
        "file:///.git/": 43,
      },
    },
    predicate: "I'm a string",
  });
  throw new Error("shoud crash");
} catch (error) {
  const actual = error;
  const expect = new TypeError(
    `predicate must be a function, got I'm a string`,
  );
  assert({ actual, expect });
}
