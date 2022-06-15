import { assert } from "@jsenv/assert"

import { ensureUrlTrailingSlash } from "@jsenv/filesystem/src/internal/ensureUrlTrailingSlash.js"

{
  const actual = ensureUrlTrailingSlash("file:///directory/file.js")
  const expected = "file:///directory/file.js/"
  assert({ actual, expected })
}

{
  const actual = ensureUrlTrailingSlash("file:///directory")
  const expected = "file:///directory/"
  assert({ actual, expected })
}

{
  const actual = ensureUrlTrailingSlash("file:///directory/")
  const expected = "file:///directory/"
  assert({ actual, expected })
}
