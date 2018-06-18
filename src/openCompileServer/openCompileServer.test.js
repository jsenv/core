import { openCompileServer } from "./openCompileServer.js"
import path from "path"

// here we want to execute any file in a browser we don't control
// for this scenario we must know which file we want to execute (an html file)
// ensure that file is on the filesystem and open the browser at the right url

openCompileServer({
  url: "http://127.0.0.1:8998",
  rootLocation: `${path.resolve(__dirname, "../../../")}`,
}).then(({ url }) => {
  console.log(`server listening, waiting for client at ${url}`)
})
