/*
 * TODO: comme pour compileFile on veut appliquer certains
 * truc sur les fichier en fonction de leurs extensions
 * pour le HTML il s'agit de:
 * - inline importmap
 * - injecter event_source_client, browser_client et toolbar_injector
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
 *
 * - rename "jsenvScriptInjection" into "browserClientInjection"
 * - rename "jsenvEventSourceClientInjection" into "eventSourceClientInjection"
 * - rename "jsenvToolbarInjection" into "toolbarInjection"
 */

import { fetchFileSystem } from "@jsenv/server"

export const createSourceFileService = ({
  projectDirectoryUrl,
  projectFileCacheStrategy,
  jsenvRemoteDirectory,
}) => {
  return async (request) => {
    const fileUrl = new URL(request.ressource.slice(1), projectDirectoryUrl)
      .href
    const fromFileSystem = () =>
      fetchFileSystem(fileUrl, {
        headers: request.headers,
        etagEnabled: projectFileCacheStrategy === "etag",
        mtimeEnabled: projectFileCacheStrategy === "mtime",
      })

    const filesystemResponse = await fromFileSystem()
    if (
      filesystemResponse.status === 404 &&
      jsenvRemoteDirectory.isFileUrlForRemoteUrl(fileUrl)
    ) {
      try {
        await jsenvRemoteDirectory.loadFileUrlFromRemote(fileUrl, request)
        // re-fetch filesystem instead to ensure response headers are correct
        return fromFileSystem()
      } catch (e) {
        if (e && e.asResponse) {
          return e.asResponse()
        }
        throw e
      }
    }
    return filesystemResponse
  }
}
