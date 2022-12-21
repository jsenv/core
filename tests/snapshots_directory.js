import { readdirSync, statSync, readFileSync } from "node:fs"
import { writeFileSync } from "@jsenv/filesystem"
import { urlToRelativeUrl } from "@jsenv/urls"

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
        const content = readFileSync(contentUrl, "utf8")
        const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl)
        fileContents[relativeUrl] = content
      }
    })
  }
  visitDirectory(directoryUrl)
  return fileContents
}

export const writeSnapshotsIntoDirectory = (directoryUrl, fileContents) => {
  Object.keys(fileContents).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, directoryUrl)
    writeFileSync(contentUrl, fileContents[relativeUrl])
  })
}
