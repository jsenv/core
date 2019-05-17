import { serveFile } from "../file-service/index.js"
import { pathnameToOperatingSystemPath } from "../operating-system-path.js"

export const serveBrowserClientFolder = ({
  projectPathname,
  browserClientRelativePath,
  request: { ressource, method, headers },
}) => {
  return serveFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}${ressource}`),
    {
      method,
      headers,
    },
  )
}
