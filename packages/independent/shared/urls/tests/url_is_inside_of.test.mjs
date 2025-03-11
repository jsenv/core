import { assert } from "@jsenv/assert";

import { urlIsInsideOf } from "@jsenv/urls";

// different origins
{
  const actual = urlIsInsideOf(
    "http://example.com/directory/file.js",
    "http://example.fr/directory/",
  );
  const expect = false;
  assert({ actual, expect });
}

// same urls
{
  const actual = urlIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/file.js",
  );
  const expect = false;
  assert({ actual, expect });
}

// outside
{
  const actual = urlIsInsideOf(
    "file:///whatever/file.js",
    "file:///directory/",
  );
  const expect = false;
  assert({ actual, expect });
}

// inside
{
  const actual = urlIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/",
  );
  const expect = true;
  assert({ actual, expect });
}

// deep inside
{
  const actual = urlIsInsideOf(
    "file:///directory/subdirectory/file.js",
    "file:///directory/",
  );
  const expect = true;
  assert({ actual, expect });
}
