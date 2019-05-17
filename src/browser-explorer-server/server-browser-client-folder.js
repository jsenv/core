import { serveFile } from "../file-service/index.js"

export const serveBrowserClientFolder = ({
  projectPathname,
  browserClientRelativePath,
  request: { ressource, method, headers },
}) => {
  return serveFile(`${projectPathname}${browserClientRelativePath}${ressource}`, {
    method,
    headers,
  })
}
