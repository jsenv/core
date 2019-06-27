import { pathnameToMeta } from "@dmail/project-structure"
import { serveFile } from "@dmail/server"

export const serveExploringPageHTML = ({
  projectPathname,
  browserClientRelativePath,
  browsableMetaMap,
  request: { ressource, headers },
}) => {
  if (!pathnameToMeta({ pathname: ressource, metaDescription: browsableMetaMap }).browsable)
    return null

  return serveFile(`${projectPathname}${browserClientRelativePath}/index.html`, { headers })
}
