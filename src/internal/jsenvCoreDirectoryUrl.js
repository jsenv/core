import { fileSystemPathToUrl, resolveDirectoryUrl } from "@jsenv/util"

let jsenvCoreDirectoryUrl
if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of dist/commonjs/main.js
    "../../",
    fileSystemPathToUrl(__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
