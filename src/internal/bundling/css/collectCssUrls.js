import postcss from "postcss"
import { urlToFileSystemPath, urlIsInsideOf, readFile } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const collectCssUrls = async (css, { projectDirectoryUrl, cssFileUrl }) => {
  const cssDependencies = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssUrlHashPlugin]).process(css, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
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
      importUrls.map(async (importUrl) => {
        const cssSource = await readFile(importUrl)
        await visitCss(cssSource, importUrl)
      }),
    )
  }

  await visitCss(css, cssFileUrl)

  return cssDependencies
}
