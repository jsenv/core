import { createCompileProfiles } from "./createCompileProfiles.js"
import path from "path"

const root = path.resolve(__dirname, "../../../")

createCompileProfiles({
  root,
  into: "compile.config.json",
}).then(() => {
  console.log("passed")
})
