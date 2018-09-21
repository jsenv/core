import { watchFile } from "./watchFile.js"
import path from "path"

process.stdin.resume()
const file = `${path.resolve(__dirname, "../../")}/src/watchFile.js`
watchFile(file, (param) => {
  console.log("file changed", param)
})
