import { readFileSync, readdirSync } from "node:fs"
import { assert } from "@jsenv/assert"

const readHtmlFiles = () => {
  const htmlFilesDirectoryUrl = new URL("./snapshots/", import.meta.url)
  const htmlFilenames = readdirSync(htmlFilesDirectoryUrl)
  const htmlFiles = {}
  htmlFilenames.forEach((htmlFilename) => {
    // to ensure order is predictable
    htmlFiles[htmlFilename] = null
  })
  htmlFilenames.forEach((htmlFilename) => {
    const htmlFileUrl = new URL(htmlFilename, htmlFilesDirectoryUrl)
    htmlFiles[htmlFilename] = String(readFileSync(htmlFileUrl))
  })
  return htmlFiles
}

// disable on windows because it would fails due to line endings (CRLF)
if (process.platform !== "win32") {
  const expected = readHtmlFiles()
  await import("./generate_snapshot_files.mjs")
  const actual = readHtmlFiles()
  assert({ actual, expected })
}
