import { serveFile } from "../../serve-file/index.js"
// import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
// import { serveCompiledFile } from "../../server-compile/serve-compiled-file/index.js"

export const serveBrowsingPage = ({
  projectFolder,
  browserClientFolderRelative,
  browsablePredicate,
  method,
  ressource,
  headers,
}) => {
  if (method !== "GET") return null

  if (browsablePredicate(ressource)) {
    return serveFile(`${projectFolder}/${browserClientFolderRelative}/index.html`, { headers })
  }

  if (ressource === "/.jsenv-well-known/browser-script.js") {
    return serveBrowsingBundle()
  }

  return null
}

const serveBrowsingBundle = ({ source }) => {
  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript",
      "content-length": Buffer.byteLength(source),
    },
    body: source,
  }
}
