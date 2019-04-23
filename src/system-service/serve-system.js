import { serveFile } from "../file-service/index.js"
import { ROOT_FOLDER } from "../ROOT_FOLDER.js"

export const WELL_KNOWN_SYSTEM_PATHNAME = `/.jsenv-well-known/system.js`
export const SYSTEM_FILENAME = `${ROOT_FOLDER}/src/system-service/s.js`

export const serveSystem = ({ ressource, headers }) => {
  if (ressource !== WELL_KNOWN_SYSTEM_PATHNAME) return null
  return serveFile(SYSTEM_FILENAME, {
    headers,
  })
}
