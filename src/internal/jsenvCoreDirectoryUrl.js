import { pathToFileUrl, resolveDirectoryUrl } from "./urlUtils.js"

let jsenvCoreDirectoryUrl
if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of dist/node/main.js
    "../../",
    pathToFileUrl(__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
