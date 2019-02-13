import path from "path"

let projectFolder = path.resolve(__dirname, "../")
if (projectFolder.endsWith("dist")) {
  projectFolder = path.resolve(projectFolder, "../")
}

export { projectFolder }
