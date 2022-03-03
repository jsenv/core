import { assert } from "@jsenv/assert"

import { setUrlExtension } from "./url_utils.js"

{
  const actual = setUrlExtension(`http://example.com/file.jsx`, ".js")
  const expected = "http://example.com/file.js"
  assert({ actual, expected })
}

{
  const actual = setUrlExtension(`http://example.com/file.mjsx?foo=bar`, ".js")
  const expected = "http://example.com/file.js?foo=bar"
  assert({ actual, expected })
}

{
  const actual = setUrlExtension(`http://example.com/file.?foo=bar`, ".js")
  const expected = "http://example.com/file.js?foo=bar"
  assert({ actual, expected })
}

{
  const actual = setUrlExtension(`http://example.com/file?foo=bar`, ".js")
  const expected = "http://example.com/file.js?foo=bar"
  assert({ actual, expected })
}

{
  const actual = setUrlExtension(`http://example.com/file.js?foo=bar`, ".")
  const expected = "http://example.com/file.?foo=bar"
  assert({ actual, expected })
}

{
  const actual = setUrlExtension(`http://example.com/file.js?foo=bar`, "")
  const expected = "http://example.com/file?foo=bar"
  assert({ actual, expected })
}
