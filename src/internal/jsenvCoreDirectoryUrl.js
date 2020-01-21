import { fileSystemPathToUrl, resolveUrl } from "@jsenv/util"

let jsenvCoreDirectoryUrl
if (typeof global.__filename === "string") {
  jsenvCoreDirectoryUrl = resolveUrl(
    // get ride of dist/commonjs/main.js
    "../../",
    fileSystemPathToUrl(global.__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveUrl(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
