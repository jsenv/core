import path from "path"

let rootname = path.resolve(__dirname, "../")
if (rootname.endsWith("dist")) {
  rootname = path.resolve(rootname, "../")
}

export { rootname }
