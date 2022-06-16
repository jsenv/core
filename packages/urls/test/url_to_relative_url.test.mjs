import { assert } from "@jsenv/assert"

import { urlToRelativeUrl } from "@jsenv/urls"

// https://github.com/medialize/URI.js/blob/73c10412ce97b760d1cb143080bee25e99d12f5b/test/test.js#L1511
// https://github.com/nodejs/node/blob/e12f48ef07e837553ea9c537b08d3e4a44d3fad2/test/parallel/test-path-relative.js

{
  const actual = urlToRelativeUrl("file:///source/a.txt", "file:///source")
  const expected = "a.txt"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///file.js", "file://")
  const expected = "file.js"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///bin", "file:///var/lib")
  const expected = "../bin"
  assert({ actual, expected })
}

// directory url
{
  const actual = urlToRelativeUrl(
    "file:///project/test/bar.js",
    "file:///project/test/dist/",
  )
  const expected = "../bar.js"
  assert({ actual, expected })
}

// different protocols
{
  const actual = urlToRelativeUrl(
    "https://example.com/dir/file.js",
    "http://example.com/dir/file.js",
  )
  const expected = "https://example.com/dir/file.js"
  assert({ actual, expected })
}

// different credentials
{
  const actual = urlToRelativeUrl(
    "http://user:pass@example.org/foo/bar",
    "http://other:pass@example.org/foo/",
  )
  const expected = "//user:pass@example.org/foo/bar"
  assert({ actual, expected })
}

// only url credentials
{
  const actual = urlToRelativeUrl(
    "http://user:pass@example.org/foo/bar",
    "http://example.org/foo/",
  )
  const expected = "//user:pass@example.org/foo/bar"
  assert({ actual, expected })
}

// only base credentials
{
  const actual = urlToRelativeUrl(
    "http://example.org/foo/bar",
    "http://user:pass@example.org/foo/",
  )
  const expected = "//example.org/foo/bar"
  assert({ actual, expected })
}

// different topleveldomain
{
  const actual = urlToRelativeUrl(
    "http://example.com/dir/file.js",
    "http://example.fr/dir/file.js",
  )
  const expected = "//example.com/dir/file.js"
  assert({ actual, expected })
}

// different port
{
  const actual = urlToRelativeUrl(
    "http://example.org:8081/foo/bar",
    "http://example.org/foo/bar",
  )
  const expected = "//example.org:8081/foo/bar"
  assert({ actual, expected })
}

// same origins and ressources
{
  const actual = urlToRelativeUrl("http://example.org", "http://example.org")
  const expected = ""
  assert({ actual, expected })
}
{
  const actual = urlToRelativeUrl("http://example.org/", "http://example.org")
  const expected = ""
  assert({ actual, expected })
}
{
  const actual = urlToRelativeUrl("http://example.org", "http://example.org/")
  const expected = ""
  assert({ actual, expected })
}
{
  const actual = urlToRelativeUrl("http://example.org/", "http://example.org/")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/foo/file.js",
    "file:///directory/file.js",
  )
  const expected = "foo/file.js"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/index.js",
    "file:///directory/foo/file.js",
  )
  const expected = "../index.js"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl(
    "file:///directory/file.js",
    "file:///directory/",
  )
  const expected = "file.js"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///var", "file:///var/lib")
  const expected = "../"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/lib")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/apache")
  const expected = "lib"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///var/lib", "file:///var/apache/")
  const expected = "../lib"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///", "file:///var/lib")
  const expected = "var/lib"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///page1/page2/foo", "file:///")
  const expected = "page1/page2/foo"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl(
    "file:///Users/a/web/b",
    "file:///Users/a/web/b/test/mails",
  )
  const expected = "../../"
  assert({ actual, expected })
}

{
  const actual = urlToRelativeUrl("file:///c:/aaaa", "file:///c:/aaaa/bbbb")
  const expected = "../"
  assert({ actual, expected })
}

// url search
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file?abcd=123",
    "http://www.example.com:8080/dir/file",
  )
  const expected = "?abcd=123"
  assert({ actual, expected })
}
{
  const actual = urlToRelativeUrl(
    "file:///dir/file.js?abcd=123",
    "file:///dir/importer.js",
  )
  const expected = "file.js?abcd=123"
  assert({ actual, expected })
}

// url hash
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file#abcd",
    "http://www.example.com:8080/dir/file",
  )
  const expected = "#abcd"
  assert({ actual, expected })
}

// url search and hash
{
  const actual = urlToRelativeUrl(
    "http://www.example.com:8080/dir/file?abcd=123#alpha",
    "http://www.example.com:8080/dir/file",
  )
  const expected = "?abcd=123#alpha"
  assert({ actual, expected })
}
