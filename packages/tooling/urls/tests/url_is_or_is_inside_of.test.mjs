import { assert } from "@jsenv/assert";
import { urlIsOrIsInsideOf } from "@jsenv/urls";

// different origins
{
  const actual = urlIsOrIsInsideOf(
    "http://example.com/directory/file.js",
    "http://example.fr/directory/",
  );
  const expect = false;
  assert({ actual, expect });
}

// same urls
{
  const actual = urlIsOrIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/file.js",
  );
  const expect = true;
  assert({ actual, expect });
}

// outside
{
  const actual = urlIsOrIsInsideOf(
    "file:///whatever/file.js",
    "file:///directory/",
  );
  const expect = false;
  assert({ actual, expect });
}

// inside
{
  const actual = urlIsOrIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/",
  );
  const expect = true;
  assert({ actual, expect });
}

// deep inside
{
  const actual = urlIsOrIsInsideOf(
    "file:///directory/subdirectory/file.js",
    "file:///directory/",
  );
  const expect = true;
  assert({ actual, expect });
}
