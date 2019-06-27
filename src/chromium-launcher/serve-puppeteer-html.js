import { serveFile } from "@dmail/server"

export const servePuppeteerHtml = ({
  projectPathname,
  browserClientRelativePath,
  request: { ressource, headers },
}) => {
  if (ressource !== "/") return null

  return serveFile(`${projectPathname}/${browserClientRelativePath}/index.html`, { headers })
}
