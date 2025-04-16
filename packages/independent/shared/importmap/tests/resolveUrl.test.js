import { assert } from "@jsenv/assert";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { resolveUrl } from "@jsenv/importmap";

// bare
{
  const actual = resolveUrl("foo", "http://domain.com");
  const expect = "http://domain.com/foo";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("foo", "http://domain.com/file.js");
  const expect = "http://domain.com/foo";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("foo", "http://domain.com/file.js/");
  const expect = "http://domain.com/file.js/foo";
  assert({ actual, expect });
}

// dot
{
  const actual = resolveUrl(".", "http://domain.com");
  const expect = "http://domain.com/";
  assert({ actual, expect });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder");
  const expect = "http://domain.com/";
  assert({ actual, expect });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder/file.js");
  const expect = "http://domain.com/folder/";
  assert({ actual, expect });
}
{
  const actual = resolveUrl(".", "http://domain.com/folder/subfolder/file.js");
  const expect = "http://domain.com/folder/subfolder/";
  assert({ actual, expect });
}

// dotslash
{
  const actual = resolveUrl("./file.js", "file:///Users/folder");
  const expect = "file:///Users/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "file:///Users/folder/");
  const expect = "file:///Users/folder/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder/");
  const expect = "http://domain.com/folder/file.js";
  assert({ actual, expect });
}
{
  const actual = resolveUrl("./file.js", "http://domain.com/folder/foo.js");
  const expect = "http://domain.com/folder/file.js";
  assert({ actual, expect });
}

// dotdotslash
{
  const actual = resolveUrl("../", "http://domain.com/folder/file.js");
  const expect = "http://domain.com/";
  assert({ actual, expect });
}

{
  const actual = resolveUrl(
    "../",
    "http://domain.com/folder/subfolder/file.js",
  );
  const expect = "http://domain.com/folder/";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../../", "http://domain.com/folder/file.js");
  const expect = "http://domain.com/";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/subfolder");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../file.js", "http://domain.com/folder/foo.js");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}

{
  const actual = resolveUrl("../../file.js", "http://domain.com");
  const expect = "http://domain.com/file.js";
  assert({ actual, expect });
}
