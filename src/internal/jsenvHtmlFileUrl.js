import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"

export const jsenvHtmlFileUrl = resolveUrl(
  "./src/internal/jsenv-html-file.html",
  jsenvCoreDirectoryUrl,
)
