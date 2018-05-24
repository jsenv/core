import { startCompileServer } from "./startCompileServer.js"
import path from "path"

startCompileServer({
  url: "http://127.0.0.1:8998",
  rootLocation: `${path.resolve(__dirname, "../../../")}`,
}).then(({ url }) => {
  console.log(`server listening, waiting for browser at ${url}src/__test__/index.html`)
})
