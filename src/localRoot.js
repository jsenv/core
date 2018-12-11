import path from "path"

let localRoot = path.resolve(__dirname, "../")
if (localRoot.endsWith("dist")) {
  localRoot = path.resolve(localRoot, "../")
}

export { localRoot }
