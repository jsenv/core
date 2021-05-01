import { requireUsingChildProcess } from "@jsenv/core"
import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"

const fileUrl = resolveUrl("./file.cjs", import.meta.url)

{
  const actual = await requireUsingChildProcess(fileUrl)
  const expected = { toto: "yep" }
  assert({ actual, expected })
}
