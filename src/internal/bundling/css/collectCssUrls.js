import postcss from "postcss"
import { urlToFileSystemPath, urlIsInsideOf, readFile } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const collectCssUrls = async (css, { projectDirectoryUrl, cssFileUrl, urlReplacements }) => {
  const cssDependencies = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssUrlHashPlugin]).process(css, {
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
      urlReplacements,
    })

    const importUrls = []
    const assetUrls = []
    result.messages.forEach(({ type, url }) => {
      // ignore external url
      if (!urlIsInsideOf(url, projectDirectoryUrl)) {
        return
      }

      if (type === "import") {
        importUrls.push(url)
      }
      if (type === "asset") {
        assetUrls.push(url)
      }
    })
    cssDependencies[cssFileUrl] = {
      source: css,
      importUrls,
      assetUrls,
    }

    await Promise.all(
      importUrls.map(async (cssUrl) => {
        const cssSource = await readFile(cssUrl)
        await visitCss(cssSource, cssUrl)
      }),
    )
  }

  await visitCss(css, cssFileUrl)

  return cssDependencies
}
