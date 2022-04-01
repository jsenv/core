import { urlToFilename } from "@jsenv/filesystem"

export const generateInlineContentUrl = ({
  url,
  extension,
  line,
  column,
  lineEnd,
  columnEnd,
}) => {
  const generatedName =
    line === lineEnd
      ? `L${line}C${column}-L${lineEnd}C${columnEnd}`
      : `L${line}-L${lineEnd}`
  const filenameRaw = urlToFilename(url)
  const filename = `${filenameRaw}@${generatedName}${extension}`
  // ideally we should keep query params from url
  const inlineContentUrl = new URL(filename, url).href
  return inlineContentUrl
}
