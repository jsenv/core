import { assert } from "@jsenv/assert";

import { urlToRelativeUrl } from "@jsenv/urls";

// https://github.com/medialize/URI.js/blob/73c10412ce97b760d1cb143080bee25e99d12f5b/test/test.js#L1511
// https://github.com/nodejs/node/blob/e12f48ef07e837553ea9c537b08d3e4a44d3fad2/test/parallel/test-path-relative.js

{
  const actual = urlToRelativeUrl("file:///source/a.txt", "file:///source");
  const expect = "a.txt";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///file.js", "file://");
  const expect = "file.js";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///bin", "file:///var/lib");
  const expect = "../bin";
  assert({ actual, expect });
}

// directory url
{
  const actual = urlToRelativeUrl(
    "file:///project/test/bar.js",
    "file:///project/test/dist/",
  );
  const expect = "../bar.js";
  assert({ actual, expect });
}

// different protocols
{
  const actual = urlToRelativeUrl(
    "https://example.com/dir/file.js",
    "http://example.com/dir/file.js",
  );
  const expect = "https://example.com/dir/file.js";
  assert({ actual, expect });
}

// different credentials
{
  const actual = urlToRelativeUrl(
    "http://user:pass@example.org/foo/bar",
    "http://other:pass@example.org/foo/",
  );
  const expect = "//user:pass@example.org/foo/bar";
  assert({ actual, expect });
}

// only url credentials
{
  const actual = urlToRelativeUrl(
    "http://user:pass@example.org/foo/bar",
    "http://example.org/foo/",
  );
  const expect = "//user:pass@example.org/foo/bar";
  assert({ actual, expect });
}

// only base credentials
{
  const actual = urlToRelativeUrl(
    "http://example.org/foo/bar",
    "http://user:pass@example.org/foo/",
  );
  const expect = "//example.org/foo/bar";
  assert({ actual, expect });
}

// different topleveldomain
{
  const actual = urlToRelativeUrl(
    "http://example.com/dir/file.js",
    "http://example.fr/dir/file.js",
  );
  const expect = "//example.com/dir/file.js";
  assert({ actual, expect });
}

// different port
{
  const actual = urlToRelativeUrl(
    "http://example.org:8081/foo/bar",
    "http://example.org/foo/bar",
  );
  const expect = "//example.org:8081/foo/bar";
  assert({ actual, expect });
}

// same origins and resources
{
  const actual = urlToRelativeUrl("http://example.org", "http://example.org");
  const expect = "";
  assert({ actual, expect });
}
{
  const actual = urlToRelativeUrl("http://example.org/", "http://example.org");
  const expect = "";
  assert({ actual, expect });
}
{
  const actual = urlToRelativeUrl("http://example.org", "http://example.org/");
  const expect = "";
  assert({ actual, expect });
}
{
  const actual = urlToRelativeUrl("http://example.org/", "http://example.org/");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/foo/file.js",
    "file:///directory/file.js",
  );
  const expect = "foo/file.js";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/index.js",
    "file:///directory/foo/file.js",
  );
  const expect = "../index.js";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/file.js",
    "file:///directory/",
  );
  const expect = "file.js";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///var", "file:///var/lib");
  const expect = "../";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/lib");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/apache");
  const expect = "lib";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/apache/");
  const expect = "../lib";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///", "file:///var/lib");
  const expect = "var/lib";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///page1/page2/foo", "file:///");
  const expect = "page1/page2/foo";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl(
    "file:///Users/a/web/b",
    "file:///Users/a/web/b/test/mails",
  );
  const expect = "../../";
  assert({ actual, expect });
}

{
  const actual = urlToRelativeUrl("file:///c:/aaaa", "file:///c:/aaaa/bbbb");
  const expect = "../";
  assert({ actual, expect });
}

// url search
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file?abcd=123",
    "http://www.example.com:8080/dir/file",
  );
  const expect = "?abcd=123";
  assert({ actual, expect });
}
{
  const actual = urlToRelativeUrl(
    "file:///dir/file.js?abcd=123",
    "file:///dir/importer.js",
  );
  const expect = "file.js?abcd=123";
  assert({ actual, expect });
}

// url hash
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file#abcd",
    "http://www.example.com:8080/dir/file",
  );
  const expect = "#abcd";
  assert({ actual, expect });
}

// url search and hash
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file?abcd=123#alpha",
    "http://www.example.com:8080/dir/file",
  );
  const expect = "?abcd=123#alpha";
  assert({ actual, expect });
}
