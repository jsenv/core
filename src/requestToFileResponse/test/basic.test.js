import fs from "fs"
import { assert } from "@dmail/assert"
import { localRoot } from "../../localRoot.js"
import { requestToFileResponse } from "../requestToFileResponse.js"

const test = async () => {
  {
    const ressource = "src/requestToFileResponse/test/file.js"
    const actual = await requestToFileResponse(
      {
        method: "GET",
        ressource,
      },
      {
        localRoot,
        cacheStrategy: "etag",
      },
    )
    const content = String(fs.readFileSync(`${localRoot}/${ressource}`))
    const length = Buffer.byteLength(content)
    const expected = {
      status: 200,
      headers: {
        "content-type": "application/javascript",
        etag: `"54-Yd2c2D1VgsR7OyJD1YIUp5mwb54"`,
        "content-length": length,
      },
      body: content,
    }
    assert({ actual, expected })
  }

  {
    const ressource = "folder/file"
    const actual = await requestToFileResponse(
      {
        method: "GET",
        ressource,
        origin: "http://domain.com",
      },
      { localRoot, locate: () => `${localRoot}/otherfolder/otherfile` },
    )
    const expected = {
      status: 307,
      headers: {
        location: "http://domain.com/otherfolder/otherfile",
      },
    }
    assert({ actual, expected })
  }

  console.log("passed")
}

test()
