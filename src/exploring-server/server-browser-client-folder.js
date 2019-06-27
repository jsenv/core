import { serveFile } from "@dmail/server"

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
