import { pathnameToMeta } from "@dmail/project-structure"
import { serveFile } from "../file-service/index.js"
import { pathnameToOperatingSystemFilename } from "../operating-system-filename.js"

export const serveBrowserExplorerPageHTML = ({
  projectPathname,
  browserClientRelativePath,
  browsableMetaMap,
  request: { ressource, headers },
}) => {
  if (!pathnameToMeta({ pathname: ressource, metaDescription: browsableMetaMap }).browsable)
    return null

  return serveFile(
    pathnameToOperatingSystemFilename(`${projectPathname}${browserClientRelativePath}/index.html`),
    { headers },
  )
}
