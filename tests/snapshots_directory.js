import { readdirSync, statSync, readFileSync, rmSync } from "node:fs"
import { writeFileSync, comparePathnames } from "@jsenv/filesystem"
import { urlToRelativeUrl } from "@jsenv/urls"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"
import { ensureUnixLineBreaks } from "@jsenv/core/src/build/line_break_unix.js"

export const readSnapshotsFromDirectory = (directoryUrl) => {
  const fileContents = {}
  directoryUrl = new URL(directoryUrl)
  const visitDirectory = (url) => {
    const directoryContent = readdirSync(url)
    directoryContent.forEach((filename) => {
      const contentUrl = new URL(filename, url)
      const stat = statSync(contentUrl)
      if (stat.isDirectory()) {
        visitDirectory(new URL(`${contentUrl}/`))
      } else {
        const isTextual = CONTENT_TYPE.isTextual(
          CONTENT_TYPE.fromUrlExtension(contentUrl),
        )
        const content = readFileSync(contentUrl, isTextual ? "utf8" : null)
        const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl)
        fileContents[relativeUrl] =
          isTextual && process.platform === "win32"
            ? ensureUnixLineBreaks(content)
            : content
      }
    })
  }
  visitDirectory(directoryUrl)
  const sortedFileContents = {}
  Object.keys(fileContents)
    .sort(comparePathnames)
    .forEach((relativeUrl) => {
      sortedFileContents[relativeUrl] = fileContents[relativeUrl]
    })
  return sortedFileContents
}

export const writeSnapshotsIntoDirectory = (directoryUrl, fileContents) => {
  rmSync(new URL(directoryUrl), {
    recursive: true,
    force: true,
  })
  Object.keys(fileContents).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, directoryUrl)
    writeFileSync(contentUrl, fileContents[relativeUrl])
  })
}
