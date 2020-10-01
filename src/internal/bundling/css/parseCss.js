import postcss from "postcss"
import { readFile } from "@jsenv/util"
import { postCssAssetPlugin } from "./postcss-asset-plugin.js"

export const parseCss = async (css, { projectDirectoryUrl, cssFileUrl }) => {
  const dependencyMap = {}

  const visitCss = async (css, cssFileUrl) => {
    const result = await postcss([postCssAssetPlugin]).process(css, {
      projectDirectoryUrl,
      cssFileUrl,
      from: cssFileUrl,
      to: cssFileUrl,
    })

    const dependencies = {}
    result.messages.forEach((message) => {
      if (message.type === "import") {
        dependencies[message.url] = message
      }
      if (message.type === "asset") {
        dependencies[message.url] = message
      }
    })
    dependencyMap[cssFileUrl] = dependencies

    await Promise.all(
      Object.keys(dependencies)
        .filter((key) => dependencies[key].type === "import")
        .map(async (key) => {
          const dependency = dependencies[key]
          const dependencyCss = await readFile(dependency.url)
          await visitCss(dependencyCss, dependency.url)
        }),
    )
  }

  await visitCss(css, cssFileUrl)

  return dependencyMap
}
