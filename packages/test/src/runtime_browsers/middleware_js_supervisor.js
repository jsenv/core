import { readFileSync } from "node:fs"
import { urlToExtension } from "@jsenv/urls"
import {
  injectSupervisorIntoHTML,
  supervisorFileUrl,
} from "@jsenv/core/src/plugins/supervisor/html_supervisor_injection.js"

export const initJsSupervisorMiddleware = async (
  page,
  { webServer, fileUrl, fileServerUrl },
) => {
  const inlineScriptContents = new Map()

  const interceptHtmlToExecute = async ({ route }) => {
    const response = await route.fetch()
    const originalBody = await response.text()
    const injectionResult = await injectSupervisorIntoHTML(
      {
        content: originalBody,
        url: fileUrl,
      },
      {
        supervisorScriptSrc: `/@fs/${supervisorFileUrl.slice(
          "file:///".length,
        )}`,
        supervisorOptions: {},
        inlineAsRemote: true,
        webServer,
        onInlineScript: ({ src, textContent }) => {
          const inlineScriptWebUrl = new URL(src, `${webServer.origin}/`).href
          inlineScriptContents.set(inlineScriptWebUrl, textContent)
        },
      },
    )
    route.fulfill({
      response,
      body: injectionResult.content,
      headers: {
        ...response.headers(),
        "content-length": Buffer.byteLength(injectionResult.content),
      },
    })
  }

  const interceptInlineScript = ({ url, route }) => {
    const inlineScriptContent = inlineScriptContents.get(url)
    route.fulfill({
      status: 200,
      body: inlineScriptContent,
      headers: {
        "content-type": "text/javascript",
        "content-length": Buffer.byteLength(inlineScriptContent),
      },
    })
  }

  const interceptFileSystemUrl = ({ url, route }) => {
    const relativeUrl = url.slice(webServer.origin.length)
    const fsPath = relativeUrl.slice("/@fs/".length)
    const fsUrl = `file:///${fsPath}`
    const fileContent = readFileSync(new URL(fsUrl), "utf8")
    route.fulfill({
      status: 200,
      body: fileContent,
      headers: {
        "content-type": "text/javascript",
        "content-length": Buffer.byteLength(fileContent),
      },
    })
  }

  await page.route("**", async (route) => {
    const request = route.request()
    const url = request.url()
    if (url === fileServerUrl && urlToExtension(url) === ".html") {
      interceptHtmlToExecute({
        url,
        request,
        route,
      })
      return
    }
    if (inlineScriptContents.has(url)) {
      interceptInlineScript({
        url,
        request,
        route,
      })
      return
    }
    const fsServerUrl = new URL("/@fs/", webServer.origin)
    if (url.startsWith(fsServerUrl)) {
      interceptFileSystemUrl({ url, request, route })
      return
    }
    route.fallback()
  })
}
