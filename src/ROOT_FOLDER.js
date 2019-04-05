import { resolve } from "path"
import { hrefToPathname } from "/node_modules/@jsenv/module-resolution/index.js"

let ROOT_FOLDER
if (typeof __filename === "string") {
  ROOT_FOLDER = resolve(__filename, "../../../") // get ride of dist/node/main.js
} else {
  ROOT_FOLDER = resolve(hrefToPathname(import.meta.url), "../../") // get ride of src/ROOT_FOLDER.js
}

export { ROOT_FOLDER }
