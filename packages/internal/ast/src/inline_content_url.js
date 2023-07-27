import { urlToFilename, urlToExtension } from "@jsenv/urls";

export const generateUrlForInlineContent = ({
  url,
  extension,
  basename,
  line,
  column,
  lineEnd,
  columnEnd,
}) => {
  if (extension === undefined) {
    extension = urlToExtension(url);
  }

  let generatedName = "";
  if (basename !== undefined) {
    generatedName += basename;
  }
  if (line !== undefined && column !== undefined) {
    generatedName = `L${line}C${column}`;
    if (lineEnd !== undefined && columnEnd !== undefined) {
      generatedName += `-L${lineEnd}C${columnEnd}`;
    }
  }

  const filenameRaw = urlToFilename(url);
  const filename = `${filenameRaw}@${generatedName}${extension}`;
  // ideally we should keep query params from url
  // maybe we could use a custom scheme like "inline:"
  const inlineContentUrl = new URL(filename, url).href;
  return inlineContentUrl;
};
