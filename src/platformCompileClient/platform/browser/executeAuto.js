import { FILE } from "./server.js"
import { executeFile } from "./executeFile.js"

if (FILE) {
  executeFile(FILE)
}
