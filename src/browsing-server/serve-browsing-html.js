import { pathnameToMeta } from "@dmail/project-structure"
import { serveFile } from "../file-service/index.js"

export const serveBrowsingHtml = ({
  projectFolder,
  browserClientFolderRelative,
  browsableMetaMap,
  ressource,
  headers,
}) => {
  if (!pathnameToMeta({ pathname: ressource, metaDescription: browsableMetaMap }).browsable)
    return null

  return serveFile(`${projectFolder}/${browserClientFolderRelative}/index.html`, { headers })
}
