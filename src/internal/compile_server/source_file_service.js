/*
 * TODO: comme pour compileFile on veut appliquer certains
 * truc sur les fichier en fonction de leurs extensions
 * pour le HTML il s'agit de:
 * - inline importmap
 * - injecter event_source_client, html_supervisor et toolbar_injector
 * - instrumenter les script inline
 * pour CSS, JS: uniquement de parse les fichier pour connaitre leur dépendance et
 * en informer le ressourceGraph
 *
 * Contrairement au compileFile:
 * - pas de sourcemap (les modifications sont que sur le HTML)
 * - pas de branchement sur des compilers customs
 * - possibilité de désactiver les modifs HTML (utile pendant le build)
 * - pas de fichier sur le filesystem (tout est en mémoire)
 * (c'est pas un requirement mais juste que c'est plus simple)
 * cela se voit bien par exemple sur html_source_file_service.js
 * qui se charge de servir les fichiers inlines
 */

import { readNodeStream } from "@jsenv/core/src/internal/read_node_stream.js"
import { scanHtml } from "@jsenv/core/src/internal/hmr/scan_html.js"

export const createSourceFileService = ({
  projectDirectoryUrl,
  projectFileCacheStrategy,
  jsenvRemoteDirectory,
}) => {
  return async (request) => {
    const url = new URL(request.ressource.slice(1), projectDirectoryUrl).href
    const response = await jsenvRemoteDirectory.fetchUrl(url, {
      request,
      projectFileCacheStrategy,
    })
    if (response.status !== 200) {
      return response
    }
    const responseContentType = response.headers["content-type"]
    const jsenvScanner = jsenvScanners[responseContentType]
    if (!jsenvScanner) {
      return response
    }
    const buffer = await readNodeStream(response.body)
    const code = String(buffer)
    // use jsenv scanner
    return {
      status: 200,
      headers: {
        "content-type": "",
        "content-length": "",
      },
      body: code,
    }
  }
}

const jsenvScanners = {
  "text/html": scanHtml,
}
