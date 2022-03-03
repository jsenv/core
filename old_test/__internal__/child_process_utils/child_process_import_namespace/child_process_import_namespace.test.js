import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

import { importUsingChildProcess } from "@jsenv/core"

const fileUrl = resolveUrl("./file.js", import.meta.url)

const actual = await importUsingChildProcess(fileUrl)
const expected = { toto: "yep" }
assert({ actual, expected })
