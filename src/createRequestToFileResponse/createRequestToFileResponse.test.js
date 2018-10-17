import { createRequestToFileResponse } from "./createRequestToFileResponse.js"
import path from "path"
import fs from "fs"
import assert from "assert"

const root = path.resolve(__dirname, "../../../")
const requestToFileResponse = createRequestToFileResponse({
  root,
  cacheStrategy: "etag",
})
const ressource = "src/__test__/file.js"

requestToFileResponse({
  method: "GET",
  ressource,
}).then((response) => {
  assert.equal(response.status, 200)

  const content = fs.readFileSync(`${root}/${ressource}`)
  assert.equal(response.body, content)

  const length = Buffer.byteLength(content)

  assert.equal(response.headers["content-length"], length)

  console.log("passed")
})
