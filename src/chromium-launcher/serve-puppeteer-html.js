import { serveFile } from "../file-service/index.js"

export const servePuppeteerHtml = ({
  projectPathname,
  browserClientRelativePath,
  request: { ressource, headers },
}) => {
  if (ressource !== "/") return null

  return serveFile(`${projectPathname}/${browserClientRelativePath}/index.html`, { headers })
}
