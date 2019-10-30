import { pathToFileUrl, resolveDirectoryUrl } from "../urlHelpers.js"

let jsenvCoreDirectoryUrl
if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of dist/node/main.js
    "../../../",
    pathToFileUrl(__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl(
    // get ride of src/jsenvCoreDirectoryUrl/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
