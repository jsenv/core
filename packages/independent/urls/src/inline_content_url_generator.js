import { urlToExtension } from "./url_to_extension.js";
import { urlToFilename } from "./url_to_filename.js";

export const generateInlineContentUrl = ({
  url,
  extension = urlToExtension(url),
  basename,
  line,
  column,
  lineEnd,
  columnEnd,
}) => {
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
