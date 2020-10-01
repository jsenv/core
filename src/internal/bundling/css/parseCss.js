import postcss from "postcss"
import { readFile } from "@jsenv/util"
import { postCssAssetPlugin } from "./postcss-asset-plugin.js"

export const parseCss = async (css, { projectDirectoryUrl, cssFileUrl }) => {
  const cssDependencies = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssAssetPlugin]).process(css, {
      projectDirectoryUrl,
      cssFileUrl,
      from: cssFileUrl,
      to: cssFileUrl,
    })

    const cssUrls = {}
    const assetUrls = {}
    result.messages.forEach(({ type, url }) => {
      if (type === "import") {
        cssUrls[url] = {}
      }
      if (type === "asset") {
        assetUrls[url] = {}
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
