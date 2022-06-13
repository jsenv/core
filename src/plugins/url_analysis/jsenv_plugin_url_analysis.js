import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/filesystem"

import { parseAndTransformHtmlUrls } from "./html/html_urls.js"
import { parseAndTransformCssUrls } from "./css/css_urls.js"
import { parseAndTransformJsUrls } from "./js/js_urls.js"
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js"

export const jsenvPluginUrlAnalysis = ({ rootDirectoryUrl, include }) => {
  let getIncludeInfo = () => undefined
  if (include) {
    const includeMetaMap = normalizeStructuredMetaMap(
      {
        include,
      },
      rootDirectoryUrl,
    )
    getIncludeInfo = (url) => {
      const meta = urlToMeta({
        url,
        structuredMetaMap: includeMetaMap,
      })
      return meta.include
    }
  }

  return {
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (reference.specifier[0] === "#") {
        reference.shouldHandle = false
        return
      }
      const includeInfo = getIncludeInfo(reference.url)
      if (includeInfo === true) {
        reference.shouldHandle = true
        return
      }
      if (includeInfo === false) {
        reference.shouldHandle = false
        return
      }
      if (reference.url.startsWith("data:")) {
        reference.shouldHandle = true
        return
      }
      if (reference.url.startsWith("file:")) {
        reference.shouldHandle = true
        return
      }
    },
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
      directory: () => {
        // on lit le dossier et pour chaque chose qu'on trouve
        // on émet une réference pour que le fichier fasse partie du build
        // ensuite il devrait pas y avoir grand chose a faire
        // la chose a faire par contre c'est de s'assurer que tous les fichiers référencé
        // comme ça se retrouve bien dans dist/folder_name/ par exemple
        // et qu'ils sont copié "tel quel" (on change par leur nom, ni le chemin dans le dossier)
        // ça se passera dans build_urls_generator ça
      },
    },
  }
}
