import { firstService } from "@jsenv/server"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

export const serveBrowserSelfExecute = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  request,
}) => {
  const browserSelfExecuteTemplateFileUrl = resolveUrl(
    "./src/internal/exploring/browserSelfExecuteTemplate.js",
    jsenvCoreDirectoryUrl,
  )
  const browserSelfExecuteTemplateFileRelativeUrl = urlToRelativeUrl(
    browserSelfExecuteTemplateFileUrl,
    projectDirectoryUrl,
  )

  return firstService(() => {
    const { ressource, headers } = request
    // "/.jsenv/browser-script.js" is written inside htmlFile
    if (ressource === "/.jsenv/browser-script.js") {
      if (!headers.referer) {
        return {
          status: 400,
          statusText: `referer missing in request headers`,
        }
      }
      let url
      try {
        url = new URL(headers.referer)
      } catch (e) {
        return {
          status: 400,
          statusText: `unexpected referer in request headers, must be an url and received ${headers.referer}`,
        }
      }

      const file = url.searchParams.get("file")

      if (stringHasConcecutiveSlashes(file)) {
        return {
          status: 400,
          statusText: `unexpected file in query string parameters, it contains consecutive slashes ${file}`,
        }
      }

      const browserSelfExecuteCompiledFileRemoteUrl = `${compileServerOrigin}/${browserSelfExecuteTemplateFileRelativeUrl}?file=${file}`
      return {
        status: 307,
        headers: {
          location: browserSelfExecuteCompiledFileRemoteUrl,
          vary: "referer",
        },
      }
    }
    return null
  })
}

const stringHasConcecutiveSlashes = (string) => {
  let previousCharIsSlash = 0
  let i = 0
  while (i < string.length) {
    const char = string[i]
    i++
    if (char === "/") {
      if (previousCharIsSlash) {
        return true
      }
      previousCharIsSlash = true
    } else {
      previousCharIsSlash = false
    }
  }
  return false
}
