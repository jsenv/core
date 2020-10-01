import postcss from "postcss"
import { resolveUrl, urlIsInsideOf, readFile } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const collectCssUrls = async (css, { projectDirectoryUrl, cssFileUrl, urlReplacements }) => {
  const cssDependencies = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssUrlHashPlugin]).process(css, {
      from: cssFileUrl,
      to: cssFileUrl,
      urlReplacements,
    })

    const importUrls = {}
    const assetUrls = {}
    result.messages.forEach(({ type, url, atRuleNode }) => {
      const fileUrl = resolveUrl(url, cssFileUrl)

      // ignore external url
      if (!urlIsInsideOf(fileUrl, projectDirectoryUrl)) {
        return
      }

      if (type === "import") {
        if (fileUrl === cssFileUrl) {
          console.warn(result, `\`@import\` loop in \`${atRuleNode.toString()}\``)
          return
        }
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
      Object.keys(importUrls).map(async (cssUrl) => {
        const cssSource = await readFile(cssUrl)
        await visitCss(cssSource, cssUrl)
      }),
    )
  }

  await visitCss(css, cssFileUrl)

  return cssDependencies
}
