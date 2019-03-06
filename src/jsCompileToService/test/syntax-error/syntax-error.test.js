import path from "path"
import { assert } from "@dmail/assert"
import { jsCompileToService } from "../../jsCompileToService.js"
import { jsCompile } from "../../../jsCompile/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const compileId = "compileId"

const test = async () => {
  const jsService = jsCompileToService(jsCompile, {
    localRoot,
    compileInto,
  })

  const response = await jsService({
    ressource: `/${compileInto}/${compileId}/src/jsCompileToService/test/syntax-error/syntax-error.js`,
    method: "GET",
  })
  const body = JSON.parse(response.body)

  assert({
    actual: {
      ...response,
      body,
    },
    expected: {
      status: 500,
      statusText: "parse error",
      headers: {
        "cache-control": "no-store",
        "content-length": response.headers["content-length"],
        "content-type": "application/json",
      },
      body: {
        name: "PARSE_ERROR",
        message: body.message,
        fileName: "src/jsCompileToService/test/syntax-error/syntax-error.js",
        lineNumber: 2,
        columnNumber: 0,
      },
    },
  })
}

test()
