import { importUsingChildProcess } from "@jsenv/core"
import { assert } from "@jsenv/assert"
import { resolveUrl } from "@jsenv/filesystem"

const fileUrl = resolveUrl("./root/main.js", import.meta.url)

{
  const actual = await importUsingChildProcess(fileUrl, {
    commandLineOptions: ["--conditions=production"],
  })
  const expected = { env: "prod" }
  assert({ actual, expected })
}
