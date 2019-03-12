import path from "path"
import { normalizePathname } from "@jsenv/module-resolution"

let projectFolder = normalizePathname(path.resolve(__dirname, "../"))
if (projectFolder.endsWith("dist")) {
  projectFolder = path.resolve(projectFolder, "../")
}

export { projectFolder }
