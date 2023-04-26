import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { pingServer } from "@jsenv/core/src/helpers/ping_server.js"
import { basicFetch } from "@jsenv/core/src/helpers/basic_fetch.js"

export const assertAndNormalizeWebServer = async (webServer) => {
  if (!webServer) {
    throw new TypeError(
      `webServer is required when running tests on browser(s)`,
    )
  }
  const unexpectedParamNames = Object.keys(webServer).filter((key) => {
    return !["origin", "moduleUrl", "rootDirectoryUrl"].includes(key)
  })
  if (unexpectedParamNames.length > 0) {
    throw new TypeError(
      `${unexpectedParamNames.join(",")}: there is no such param to webServer`,
    )
  }

  let aServerIsListening = await pingServer(webServer.origin)
  if (!aServerIsListening) {
    if (!webServer.moduleUrl) {
      throw new TypeError(
        `webServer.moduleUrl is required as there is no server listening "${webServer.origin}"`,
      )
    }
    try {
      process.env.IMPORTED_BY_TEST_PLAN = "1"
      await import(webServer.moduleUrl)
      delete process.env.IMPORTED_BY_TEST_PLAN
    } catch (e) {
      if (e.code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(
          `webServer.moduleUrl does not lead to a file at "${webServer.moduleUrl}"`,
        )
      }
      throw e
    }
    aServerIsListening = await pingServer(webServer.origin)
    if (!aServerIsListening) {
      throw new Error(
        `webServer.moduleUrl did not start a server listening at "${webServer.origin}", check file at "${webServer.moduleUrl}"`,
      )
    }
  }
  const { headers } = await basicFetch(webServer.origin, {
    method: "GET",
    rejectUnauthorized: false,
    headers: {
      "x-server-inspect": "1",
    },
  })
  if (String(headers["server"]).includes("jsenv_dev_server")) {
    webServer.isJsenvDevServer = true
    const { json } = await basicFetch(`${webServer.origin}/__params__.json`, {
      rejectUnauthorized: false,
    })
    if (webServer.rootDirectoryUrl === undefined) {
      const jsenvDevServerParams = await json()
      webServer.rootDirectoryUrl = jsenvDevServerParams.sourceDirectoryUrl
    } else {
      webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
        webServer.rootDirectoryUrl,
        "webServer.rootDirectoryUrl",
      )
    }
  } else {
    webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
      webServer.rootDirectoryUrl,
      "webServer.rootDirectoryUrl",
    )
  }
}
