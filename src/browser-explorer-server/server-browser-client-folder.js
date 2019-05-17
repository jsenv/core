import { serveFile } from "../file-service/index.js"
import { pathnameToOperatingSystemFilename } from "../operating-system-filename.js"

export const serveBrowserClientFolder = ({
  projectPathname,
  browserClientRelativePath,
  request: { ressource, method, headers },
}) => {
  return serveFile(
    pathnameToOperatingSystemFilename(`${projectPathname}${browserClientRelativePath}${ressource}`),
    {
      method,
      headers,
    },
  )
}
