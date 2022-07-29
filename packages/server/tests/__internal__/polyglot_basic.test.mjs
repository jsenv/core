import https from "node:https"
import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"
import { listen } from "@jsenv/server/src/internal/listen.js"
import { createPolyglotServer } from "@jsenv/server/src/internal/server-polyglot.js"
import { listenClientError } from "@jsenv/server/src/internal/listenClientError.js"
import { listenRequest } from "@jsenv/server/src/internal/listenRequest.js"
import {
  testServerCertificate,
  testServerCertificatePrivateKey,
} from "../test_certificate.js"

const server = await createPolyglotServer({
  certificate: testServerCertificate,
  privateKey: testServerCertificatePrivateKey,
})
listenRequest(server, (nodeRequest, nodeResponse) => {
  nodeResponse.writeHead(200, {
    "content-type": "text/plain",
  })
  nodeResponse.end(nodeRequest.socket.encrypted ? "https" : "http")
})
server.unref()
const port = await listen({
  server,
  port: 0,
  hostname: "127.0.0.1",
})

// http request
{
  const response = await fetchUrl(`http://127.0.0.1:${port}`)
  const actual = {
    status: response.status,
    headers: headersToObject(response.headers),
    body: await response.text(),
  }
  const expected = {
    status: 200,
    headers: {
      "connection": "close",
      "content-type": "text/plain",
      "date": actual.headers.date,
      "transfer-encoding": "chunked",
    },
    body: "http",
  }
  assert({ actual, expected })
}

// https request
{
  const response = await fetchUrl(`https://127.0.0.1:${port}`, {
    ignoreHttpsError: true,
  })
  const actual = {
    status: response.status,
    headers: headersToObject(response.headers),
    body: await response.text(),
  }
  const expected = {
    status: 200,
    headers: {
      "connection": "close",
      "content-type": "text/plain",
      "date": actual.headers.date,
      "transfer-encoding": "chunked",
    },
    body: "https",
  }
  assert({ actual, expected })
}

// https request rejected (using node request)
// does not work when executed by jsenv: for some reason
// the https request is not rejected despites certificate being self signed
if (!process.env.JSENV) {
  let clientError
  listenClientError(server, (error) => {
    clientError = error
  })
  try {
    const request = https.get({
      hostname: "127.0.0.1",
      port,
      rejectUnauthorized: true,
    })
    await new Promise((resolve, reject) => {
      request.on("error", reject)
      request.on("response", resolve)
    })
    throw new Error("should throw")
  } catch (error) {
    const actual = {
      code: error.code,
      message: error.message,
    }
    const expected = {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      message: `unable to verify the first certificate`,
    }
    assert({ actual, expected })
  }

  await new Promise((resolve) => setTimeout(resolve, 100))
  {
    const actual = clientError
    const expected = new Error("socket hang up")
    expected.code = "ECONNRESET"
    assert({ actual, expected })
  }
}

// https request rejected (using node-fetch)
// does not work when executed by jsenv: for some reason
// the https request is not rejected despites certificate being self signed
if (!process.env.JSENV) {
  let clientError
  listenClientError(server, (error) => {
    clientError = error
  })
  try {
    await fetchUrl(`https://127.0.0.1:${port}`, { ignoreHttpsError: false })
    throw new Error("should throw")
  } catch (error) {
    const actual = {
      code: error.code,
      message: error.message,
    }
    const expected = {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      message: `request to https://127.0.0.1:${port}/ failed, reason: unable to verify the first certificate`,
    }
    assert({ actual, expected })
  }

  await new Promise((resolve) => setTimeout(resolve, 100))
  {
    const actual = clientError
    const expected = new Error("socket hang up")
    expected.code = "ECONNRESET"
    assert({ actual, expected })
  }
}
