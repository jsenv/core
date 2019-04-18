import { serveFile } from "../../serve-file/index.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

export const serveSystem = ({ headers }) => {
  return serveFile(`${ROOT_FOLDER}/src/systemjs/s.js`, {
    headers,
  })
}
