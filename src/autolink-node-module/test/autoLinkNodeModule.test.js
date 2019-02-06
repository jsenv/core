import { autoLinkNodeModule } from "../autoLinkNodeModule.js"
import { localRoot } from "../../localRoot.js"

const barFolder = `${localRoot}/src/autolink-node-module/test/node_modules/bar`

autoLinkNodeModule({
  folder: barFolder,
  verbose: true,
})
