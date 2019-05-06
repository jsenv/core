import { pathnameToMeta } from "@dmail/project-structure"
import { serveFile } from "../file-service/index.js"

export const serveBrowserExplorerPageHTML = ({
  projectFolder,
  browserClientFolderRelative,
  browsableMetaMap,
  request: { ressource, headers },
}) => {
  if (!pathnameToMeta({ pathname: ressource, metaDescription: browsableMetaMap }).browsable)
    return null

  return serveFile(`${projectFolder}/${browserClientFolderRelative}/index.html`, { headers })
}
