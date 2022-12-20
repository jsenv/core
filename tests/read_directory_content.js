import { readdirSync, statSync, readFileSync } from "node:fs"
import { urlToRelativeUrl } from "@jsenv/urls"

export const readDirectoryContent = (directoryUrl) => {
  const files = {}
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
        files[relativeUrl] = content
      }
    })
  }
  visitDirectory(directoryUrl)
  return files
}
