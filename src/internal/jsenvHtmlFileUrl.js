import { resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"

export const jsenvHtmlFileUrl = resolveUrl(
  "./src/internal/executing/jsenv-html-file.html",
  jsenvCoreDirectoryUrl,
)
