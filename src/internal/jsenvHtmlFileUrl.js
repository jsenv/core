import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"

export const jsenvHtmlFileUrl = resolveUrl(
  "./src/internal/jsenv-html-file.html",
  jsenvCoreDirectoryUrl,
)
