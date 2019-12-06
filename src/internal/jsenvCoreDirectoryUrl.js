import { filePathToUrl, resolveDirectoryUrl } from "./urlUtils.js"

let jsenvCoreDirectoryUrl
if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of dist/commonjs/main.js
    "../../",
    filePathToUrl(__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
