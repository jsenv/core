import { listFilesToExecute } from "./serverBrowser.js"
import assert from "assert"
import path from "path"

const localRoot = path.resolve(__dirname, "../../../")

const test = async () => {
  const files = await listFilesToExecute(localRoot)
  assert.equal(files.length > 0, true)
  console.log("passed")
}

test()
