import { serveFile } from "../file-service/index.js"

export const serveBrowserClientFolder = ({
  projectFolder,
  browserClientFolderRelative,
  ressource,
  method,
  headers,
}) => {
  return serveFile(`${projectFolder}/${browserClientFolderRelative}${ressource}`, {
    method,
    headers,
  })
}
