import { startCompileServer } from "./startCompileServer.js"
import path from "path"

startCompileServer({
	location: `${path.resolve(__dirname, "../../")}`,
}).then(({ url }) => {
	console.log(`server listening, waiting for browser at ${url}src/__test__/index.html`)
})
