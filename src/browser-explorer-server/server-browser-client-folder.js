import { serveFile } from "../file-service/index.js"

export const serveBrowserClientFolder = ({
  projectFolder,
  browserClientFolderRelative,
  request: { ressource, method, headers },
}) => {
  return serveFile(`${projectFolder}/${browserClientFolderRelative}${ressource}`, {
    method,
    headers,
  })
}
