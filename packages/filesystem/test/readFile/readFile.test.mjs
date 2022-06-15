import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/urls"

import { readFile } from "@jsenv/filesystem"

{
  const txtFileUrl = resolveUrl("./file.txt", import.meta.url)
  const actual = await readFile(txtFileUrl, { as: "string" })
  const expected = "hello world"
  assert({ actual, expected })
}
