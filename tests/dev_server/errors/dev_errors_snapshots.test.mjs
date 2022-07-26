import { readFileSync, readdirSync } from "node:fs"
import { assert } from "@jsenv/assert"

const readHtmlFiles = () => {
  const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url)
  const snapshotFilenames = readdirSync(snapshotDirectoryUrl)
  const htmlFiles = {}
  snapshotFilenames.forEach((snapshotFilename) => {
    if (!snapshotFilename.endsWith(".html")) {
      return
    }
    const htmlFileUrl = new URL(snapshotFilename, snapshotDirectoryUrl)
    htmlFiles[snapshotFilename] = String(readFileSync(htmlFileUrl))
  })
  return htmlFiles
}

// disable on windows because it would fails due to line endings (CRLF)
if (process.platform !== "win32") {
  const expected = readHtmlFiles()
  process.env.FROM_TESTS = "true"
  await import("./generate_snapshot_files.mjs")
  const actual = readHtmlFiles()
  assert({ actual, expected })
}
