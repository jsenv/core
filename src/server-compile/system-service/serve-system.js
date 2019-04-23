import { serveFile } from "../../serve-file/index.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

const WELL_KNOWN_SYSTEM_PATHNAME = `/.jsenv-well-known/system.js`

export const serveSystem = ({ ressource, headers }) => {
  if (ressource !== WELL_KNOWN_SYSTEM_PATHNAME) return null
  return serveFile(`${ROOT_FOLDER}/src/systemjs/s.js`, {
    headers,
  })
}
