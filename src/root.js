import path from "path"

let root = path.resolve(__dirname, "../")
if (root.endsWith("dist")) {
  root = path.resolve(root, "../")
}

export { root }
