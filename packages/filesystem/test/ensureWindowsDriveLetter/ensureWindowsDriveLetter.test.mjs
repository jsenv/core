import { assert } from "@jsenv/assert"

import { ensureWindowsDriveLetter } from "@jsenv/filesystem"

if (process.platform === "win32") {
  // url http, basUrl file
  {
    const actual = ensureWindowsDriveLetter(
      "http://example.com/file.js",
      "file:///C:/file",
    )
    const expected = "http://example.com/file.js"
    assert({ actual, expected })
  }

  // url file, baseUrl file
  {
    const actual = ensureWindowsDriveLetter(
      "file:///file.js",
      "file:///C:/directory/file.js",
    )
    const expected = "file:///C:/file.js"
    assert({ actual, expected })
  }

  // url file, baseUrl http
  {
    const actual = ensureWindowsDriveLetter(
      "file:///file.js",
      "http://example.com",
    )
    const expected = `file:///${process.cwd()[0]}:/file.js`
    assert({ actual, expected })
  }

  // url file with drive letter, baseUrl http
  {
    const actual = ensureWindowsDriveLetter(
      "file:///C:/file.js",
      "http://example.com",
    )
    const expected = "file:///C:/file.js"
    assert({ actual, expected })
  }
  // url missing
  try {
    ensureWindowsDriveLetter()
  } catch (actual) {
    const expected = new Error(`absolute url expected but got undefined`)
    assert({ actual, expected })
  }

  // url relative
  try {
    ensureWindowsDriveLetter("./file.js")
  } catch (actual) {
    const expected = new Error(`absolute url expected but got ./file.js`)
    assert({ actual, expected })
  }

  // url file, baseUrl undefined
  try {
    ensureWindowsDriveLetter("file:///file.js")
  } catch (actual) {
    const expected = new Error(
      `absolute baseUrl expected but got undefined to ensure windows drive letter on file:///file.js`,
    )
    assert({ actual, expected })
  }

  // url file, baseUrl relative
  try {
    ensureWindowsDriveLetter("file:///file.js", "./file.js")
  } catch (actual) {
    const expected = new Error(
      `absolute baseUrl expected but got ./file.js to ensure windows drive letter on file:///file.js`,
    )
    assert({ actual, expected })
  }

  // url file, baseUrl file without drive letter
  try {
    ensureWindowsDriveLetter("file:///file.js", "file:///dir")
  } catch (actual) {
    const expected = new Error(
      `drive letter expected on baseUrl but got file:///dir to ensure windows drive letter on file:///file.js`,
    )
    assert({ actual, expected })
  }
} else {
  // the idea is to ensure the url is untouched because there no is drive letter concept outside windows

  // url file and baseUrl file
  const actual = ensureWindowsDriveLetter(
    "file:///file.js",
    "file:///C:/file.js",
  )
  const expected = "file:///file.js"
  assert({ actual, expected })
}
