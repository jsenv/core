// import { assert } from "@dmail/assert"
import { parseImport } from "../../parseImport.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-import/test/import-circular/import-circular.js"

parseImport({
  file: `${localRoot}/${ressource}`,
})
