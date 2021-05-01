import { requireUsingChildProcess } from "@jsenv/core"
import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/util"

const fileUrl = resolveUrl("./root/main.cjs", import.meta.url)

{
  const actual = await requireUsingChildProcess(fileUrl, {
    commandLineOptions: ["--conditions=production"],
  })
  const expected = { env: "prod" }
  assert({ actual, expected })
}
