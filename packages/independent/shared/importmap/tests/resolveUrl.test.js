import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/importmap";

// bare
{
  const actual = resolveUrl("foo", "http://domain.com");
  const expected = "http://domain.com/foo";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("foo", "http://domain.com/file.js");
  const expected = "http://domain.com/foo";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("foo", "http://domain.com/file.js/");
  const expected = "http://domain.com/file.js/foo";
  assert({ actual, expected });
}

// dot
{
  const actual = resolveUrl(".", "http://domain.com");
  const expected = "http://domain.com/";
  assert({ actual, expected });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder");
  const expected = "http://domain.com/";
  assert({ actual, expected });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder/file.js");
  const expected = "http://domain.com/folder/";
  assert({ actual, expected });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder/subfolder/file.js");
  const expected = "http://domain.com/folder/subfolder/";
  assert({ actual, expected });
}

// dotslash
{
  const actual = resolveUrl("./file.js", "file:///Users/folder");
  const expected = "file:///Users/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "file:///Users/folder/");
  const expected = "file:///Users/folder/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder/");
  const expected = "http://domain.com/folder/file.js";
  assert({ actual, expected });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder/foo.js");
  const expected = "http://domain.com/folder/file.js";
  assert({ actual, expected });
}

// dotdotslash
{
  const actual = resolveUrl("../", "http://domain.com/folder/file.js");
  const expected = "http://domain.com/";
  assert({ actual, expected });
}

{
  const actual = resolveUrl(
    "../",
    "http://domain.com/folder/subfolder/file.js",
  );
  const expected = "http://domain.com/folder/";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../../", "http://domain.com/folder/file.js");
  const expected = "http://domain.com/";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/subfolder");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/foo.js");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}

{
  const actual = resolveUrl("../../file.js", "http://domain.com");
  const expected = "http://domain.com/file.js";
  assert({ actual, expected });
}
