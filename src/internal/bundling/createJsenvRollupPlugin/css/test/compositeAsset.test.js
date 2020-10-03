import { resolveUrl } from "@jsenv/util"
import { createCompositeAssetHandler } from "../../compositeAsset.js"
import { jsenvCompositeAssetHooks } from "../../jsenvCompositeAssetHooks.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)

const compositeAssetHandler = createCompositeAssetHandler(jsenvCompositeAssetHooks, {
  projectDirectoryUrl,
  emitAsset: (url) => {
    return url
  },
})

await compositeAssetHandler.getAssetReferenceId(cssFileUrl)
console.log(compositeAssetHandler.inspect())

//   rollup.emitFile({
//   type: "asset",
//   fileName,
//   source: assetContent,
// })
// const fileName = urlToRelativeUrl(assetUrlForCaching, projectDirectoryUrl)
