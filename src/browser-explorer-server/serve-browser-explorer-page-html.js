import { pathnameToMeta } from "@dmail/project-structure"
import { serveFile } from "../file-service/index.js"
import { pathnameToOperatingSystemPath } from "../operating-system-path.js"

export const serveBrowserExplorerPageHTML = ({
  projectPathname,
  browserClientRelativePath,
  browsableMetaMap,
  request: { ressource, headers },
}) => {
  if (!pathnameToMeta({ pathname: ressource, metaDescription: browsableMetaMap }).browsable)
    return null

  return serveFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}/index.html`),
    { headers },
  )
}
