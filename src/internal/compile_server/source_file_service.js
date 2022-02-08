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

import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import { resolveUrl } from "@jsenv/filesystem"

import { readNodeStream } from "@jsenv/core/src/internal/read_node_stream.js"
import { injectHmr } from "@jsenv/core/src/internal/autoreload/hmr_injection.js"

export const createSourceFileService = ({
  projectDirectoryUrl,
  ressourceGraph,
  jsenvRemoteDirectory,
  projectFileCacheStrategy,
  modifiers,
}) => {
  const ressourceArtifacts = createRessourceArtifacts()

  return async (request) => {
    const urlObject = new URL(request.ressource.slice(1), projectDirectoryUrl)
    const hmr = urlObject.searchParams.get("hmr")
    urlObject.searchParams.delete("hmr")
    const url = urlObject.href

    const handleResponse = async (response) => {
      if (response.status !== 200) {
        return response
      }
      const responseContentType = response.headers["content-type"]
      const modifier = modifiers[responseContentType]
      if (!modifier) {
        return response
      }
      const responseBodyAsString =
        typeof response.body === "string"
          ? response.body
          : String(await readNodeStream(response.body))
      const { content, artifacts = [] } = await modifier({
        url,
        content: responseBodyAsString,
      })
      ressourceArtifacts.updateRessourceArtifacts(url, artifacts)

      if (hmr) {
        const body = await injectHmr({
          projectDirectoryUrl,
          ressourceGraph,
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
      return {
        status: 200,
        headers: {
          "content-type": responseContentType,
          "content-length": Buffer.byteLength(content),
          "cache-control": "no-cache",
        },
        body: content,
      }
    }

    // artifacts are inline ressource found in HTML (inline scripts, styles, ...)
    const artifactResponse = ressourceArtifacts.getResponseForUrl(url)
    if (artifactResponse) {
      return handleResponse(artifactResponse)
    }
    try {
      const response = await jsenvRemoteDirectory.fetchUrl(url, {
        request,
        projectFileCacheStrategy,
      })
      return handleResponse(response)
    } catch (error) {
      if (error && error.asResponse) {
        return error.asResponse()
      }
      return convertFileSystemErrorToResponseProperties(error)
    }
  }
}

/**
 * artifacts can be represented as below
 * "file:///project_directory/index.html.10.js": {
 *   "ownerUrl": "file:///project_directory/index.html",
 *   "contentType": "application/javascript",
 *   "content": "console.log(`Hello world`)"
 * }
 * It is used to serve inline ressources as if they where inside a file
 * Every time the html file is retransformed, the list of inline ressources inside it
 * are deleted so that when html file and page is reloaded, the inline ressources are updated
 */
const createRessourceArtifacts = () => {
  const artifactMap = new Map()

  const getResponseForUrl = (url) => {
    const artifact = artifactMap.get(url)
    if (!artifact) {
      return null
    }
    return {
      status: 200,
      headers: {
        "content-type": artifact.contentType,
        "content-length": Buffer.byteLength(artifact.content),
      },
      body: artifact.content,
    }
  }

  const updateRessourceArtifacts = (ownerUrl, artifacts) => {
    artifactMap.forEach((artifact, artifactUrl) => {
      if (artifact.ownerUrl === ownerUrl) {
        artifactMap.delete(artifactUrl)
      }
    })
    artifacts.forEach(({ specifier, contentType, content }) => {
      artifactMap.set(resolveUrl(specifier, ownerUrl), {
        ownerUrl,
        contentType,
        content,
      })
    })
  }

  return {
    getResponseForUrl,
    updateRessourceArtifacts,
  }
}
