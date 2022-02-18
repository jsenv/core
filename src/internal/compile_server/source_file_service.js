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

import { injectHmr } from "@jsenv/core/src/internal/autoreload/hmr_injection.js"

export const createSourceFileService = ({
  projectDirectoryUrl,
  ressourceGraph,
  sourceFileFetcher,
  modifiers,
}) => {
  return async (request) => {
    const urlObject = new URL(request.ressource.slice(1), projectDirectoryUrl)
    const hmr = urlObject.searchParams.get("hmr")
    urlObject.searchParams.delete("hmr")
    const url = urlObject.href

    const fileInterface = await sourceFileFetcher.loadSourceFile(url, {
      request,
      cacheStrategy:
        // disable 304 for html files otherwise the html inline ressources are not parsed
        urlObject.pathname.endsWith(".html") ? "none" : undefined,
    })
    if (fileInterface.response.status !== 200) {
      // for 304 it means html files are not re-parsed
      return fileInterface.response
    }
    const responseContentType = fileInterface.response.headers["content-type"]
    const modifier = modifiers[responseContentType]
    if (!modifier) {
      return fileInterface.response
    }
    const responseBodyAsString = await fileInterface.readAsString()
    const content = await modifier({
      sourceFileFetcher,
      url,
      content: responseBodyAsString,
    })
    if (!hmr) {
      return {
        ...fileInterface.response,
        headers: {
          ...fileInterface.response.headers,
          "content-length": Buffer.byteLength(content),
        },
        body: content,
      }
    }
    const body = await injectHmr({
      projectDirectoryUrl,
      ressourceGraph,
      sourceFileFetcher,
      url,
      contentType: responseContentType,
      moduleFormat: "esmodule",
      content,
    })
    return {
      status: 200,
      headers: {
        "content-type": responseContentType,
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  }
}
