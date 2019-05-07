import { serveFile } from "../file-service/index.js"

export const servePuppeteerHtml = ({
  projectFolder,
  browserClientFolderRelative,
  request: { ressource, headers },
}) => {
  if (ressource !== "/") return null

  return serveFile(`${projectFolder}/${browserClientFolderRelative}/index.html`, { headers })
}
