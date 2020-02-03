import { Script } from "vm"
import { readFileSync } from "fs"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"
import { memoize } from "./memoize.js"

export const supportsDynamicImport = memoize(async () => {
  const fileUrl = resolveUrl("./src/internal/dynamicImportSource.js", jsenvCoreDirectoryUrl)
  const filePath = urlToFileSystemPath(fileUrl)
  const fileAsString = String(readFileSync(filePath))

  try {
    return await evalSource(fileAsString, filePath)
  } catch (e) {
    return false
  }
})

const evalSource = (code, filePath) => {
  const script = new Script(code, {
    filename: filePath,
  })
  return script.runInThisContext()
}
