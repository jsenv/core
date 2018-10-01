import { buildGroup } from "./buildGroup.js"
import path from "path"

const root = path.resolve(__dirname, "../../../")

buildGroup({
  root,
})
