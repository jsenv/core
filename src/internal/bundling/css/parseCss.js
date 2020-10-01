import postcss from "postcss"
import { resolveUrl, urlIsInsideOf, readFile } from "@jsenv/util"
import { postCssAssetPlugin } from "./postcss-asset-plugin.js"

export const parseCss = async (css, { projectDirectoryUrl, cssFileUrl }) => {
  const cssDependencies = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssAssetPlugin]).process(css, {
      from: cssFileUrl,
      to: cssFileUrl,
    })

    const cssUrls = {}
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
        cssUrls.push(url)
      }
      if (type === "asset") {
        assetUrls.push(url)
      }
    })
    cssDependencies[cssFileUrl] = {
      source: css,
      cssUrls,
      assetUrls,
    }

    await Promise.all(
      Object.keys(cssUrls).map(async (cssUrl) => {
        const cssSource = await readFile(cssUrl)
        await visitCss(cssSource, cssUrl)
      }),
    )
  }

  await visitCss(css, cssFileUrl)

  return cssDependencies
}
