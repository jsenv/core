import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

import { requireUsingChildProcess } from "@jsenv/core"

const fileUrl = resolveUrl("./file.cjs", import.meta.url)

const actual = await requireUsingChildProcess(fileUrl)
const expected = { toto: "yep" }
assert({ actual, expected })
