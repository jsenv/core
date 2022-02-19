import { existsSync } from "node:fs"
import { fetchFileSystem } from "@jsenv/server"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToRessource,
  normalizeStructuredMetaMap,
  urlToMeta,
  writeFile,
  resolveUrl,
} from "@jsenv/filesystem"
import { validateResponseIntegrity } from "@jsenv/integrity"

import { asUrlWithoutSearch } from "@jsenv/core/src/internal/url_utils.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { readNodeStream } from "@jsenv/core/src/internal/read_node_stream.js"

import { originDirectoryConverter } from "./origin_directory_converter.js"

export const createSourceFileFetcher = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  preservedUrls,
  projectFileCacheStrategy,
}) => {
  /**
   * can be represented as below
   * "file:///project_directory/index.html.10.js": {
   *   "ownerUrl": "file:///project_directory/index.html",
   *   "line": 10,
   *   "column": 5,
   *   "contentType": "application/javascript",
   *   "content": "console.log(`Hello world`)"
   * }
   * It is used to serve inline ressources as if they where inside a file
   * Every time the html file is retransformed, the list of inline ressources inside it
   * are deleted so that when html file and page is reloaded, the inline ressources are updated
   */
  const inlineRessourceMap = new Map()
  const updateInlineRessources = ({
    htmlUrl,
    htmlContent,
    inlineRessources,
  }) => {
    inlineRessourceMap.forEach((inlineRessource, inlineRessourceUrl) => {
      if (inlineRessource.htmlUrl === htmlUrl) {
        inlineRessourceMap.delete(inlineRessourceUrl)
      }
    })
    inlineRessources.forEach((inlineRessource) => {
      const inlineRessourceUrl = asUrlWithoutSearch(
        new URL(inlineRessource.specifier, htmlUrl),
      )
      inlineRessourceMap.set(inlineRessourceUrl, {
        ...inlineRessource,
        htmlUrl,
        htmlContent,
      })
    })
  }
  const isInlineUrl = (url) => {
    const urlWithoutSearch = asUrlWithoutSearch(url)
    return inlineRessourceMap.has(urlWithoutSearch)
  }
  const getInlineUrlSite = (url) => {
    const urlWithoutSearch = asUrlWithoutSearch(url)
    const inlineRessource = inlineRessourceMap.get(urlWithoutSearch)
    return inlineRessource
      ? {
          url: inlineRessource.htmlUrl,
          line: inlineRessource.htmlLine,
          column: inlineRessource.htmlColumn,
          source: inlineRessource.htmlContent,
        }
      : null
  }

  const jsenvRemoteDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}.remote/`
  const structuredMetaMap = normalizeStructuredMetaMap(
    { preserved: preservedUrls },
    projectDirectoryUrl,
  )
  const isPreservedUrl = (url) => {
    const meta = urlToMeta({ url, structuredMetaMap })
    return Boolean(meta.preserved)
  }
  const isRemoteUrl = (url) => {
    return url.startsWith("http://") || url.startsWith("https://")
  }
  const isFileUrlForRemoteUrl = (url) => {
    return urlIsInsideOf(url, jsenvRemoteDirectoryUrl)
  }
  const fileUrlFromRemoteUrl = (remoteUrl) => {
    const origin = originFromUrlOrUrlPattern(remoteUrl)
    const ressource = urlToRessource(remoteUrl)
    const [pathname, search = ""] = ressource.split("?")
    const directoryName = originDirectoryConverter.toDirectoryName(origin)
    const fileRelativeUrl = `${directoryName}${
      pathname === "" ? "/" : pathname
    }`
    const fileUrl = `${jsenvRemoteDirectoryUrl}${fileRelativeUrl}${search}`
    return fileUrl
  }
  const asFileUrlSpecifierIfRemote = (urlSpecifier, baseUrl) => {
    const url = resolveUrl(urlSpecifier, baseUrl)
    if (!isRemoteUrl(url)) {
      return urlSpecifier
    }
    if (isPreservedUrl(url)) {
      return urlSpecifier
    }
    const fileUrl = fileUrlFromRemoteUrl(url)
    const relativeUrl = urlToRelativeUrl(fileUrl, baseUrl)
    return `./${relativeUrl}`
  }
  const remoteUrlFromFileUrl = (fileUrl) => {
    const fileRelativeUrl = urlToRelativeUrl(fileUrl, jsenvRemoteDirectoryUrl)
    const firstSlashIndex = fileRelativeUrl.indexOf("/")
    const directoryName = fileRelativeUrl.slice(0, firstSlashIndex)
    const origin = originDirectoryConverter.fromDirectoryName(directoryName)
    const ressource = fileRelativeUrl.slice(firstSlashIndex)
    const remoteUrlObject = new URL(ressource, origin)
    remoteUrlObject.searchParams.delete("integrity")
    const remoteUrl = remoteUrlObject.href
    return remoteUrl
  }

  const loadSourceFile = async (
    url,
    { request, cacheStrategy = projectFileCacheStrategy },
  ) => {
    const urlWithoutSearch = asUrlWithoutSearch(url)
    const inlineRessource = inlineRessourceMap.get(urlWithoutSearch)
    if (inlineRessource) {
      return {
        response: {
          status: 200,
          headers: {
            "content-type": inlineRessource.contentType,
            "content-length": Buffer.byteLength(inlineRessource.content),
          },
          body: inlineRessource.content,
        },
        readAsString: () => inlineRessource.content,
      }
    }
    if (isFileUrlForRemoteUrl(url)) {
      if (!existsSync(new URL(url))) {
        const remoteUrlResponseBody = await loadAsRemoteUrl({
          url,
          urlToFetch: remoteUrlFromFileUrl(url),
          request,
        })
        await writeFile(url, remoteUrlResponseBody)
      }
      // re-fetch filesystem instead to ensure response headers are correct
    }
    const response = await fetchFileSystem(url, {
      headers: request.headers,
      etagEnabled: cacheStrategy === "etag",
      mtimeEnabled: cacheStrategy === "mtime",
    })
    return {
      response,
      readAsString: async () => {
        const buffer = await readNodeStream(response.body)
        return String(buffer)
      },
    }
  }

  return {
    isInlineUrl,
    getInlineUrlSite,
    updateInlineRessources,

    isRemoteUrl,
    isFileUrlForRemoteUrl,
    fileUrlFromRemoteUrl,
    asFileUrlSpecifierIfRemote,
    remoteUrlFromFileUrl,

    loadSourceFile,
  }
}

// The original file might be behind an http url.
// In that case jsenv try first to read file from filesystem
// in ".jsenv/.http/" directory. If not found, the url
// is fetched and file is written in that ".jsenv/.http/" directory.
// After that the only way to re-fetch this ressource is
// to delete the content of ".jsenv/.http/"
const loadAsRemoteUrl = async ({ url, urlToFetch, request }) => {
  const urlObject = new URL(url)
  const integrity = urlObject.searchParams.get("integrity")
  if (integrity) {
    urlObject.searchParams.delete("integrity")
  }
  const requestHeadersToForward = { ...request.headers }
  delete requestHeadersToForward.host
  const response = await fetchUrl(urlToFetch, {
    mode: "cors",
    headers: requestHeadersToForward,
  })
  if (response.status !== 200) {
    return createBadGatewayResponse({
      code: "UNEXPECTED_STATUS",
      message: `unexpected status for ressource "${urlToFetch}", received ${response.status}`,
    })
  }
  const responseBodyAsBuffer = Buffer.from(await response.arrayBuffer())
  if (integrity) {
    try {
      validateResponseIntegrity(
        {
          url: response.url,
          type: response.type,
          dataRepresentation: responseBodyAsBuffer,
        },
        integrity,
      )
    } catch (e) {
      return createBadGatewayResponse({
        code: e.code,
        message: e.message,
      })
    }
  }
  return responseBodyAsBuffer
}

const createBadGatewayResponse = ({ code, message }) => {
  const data = {
    code,
    message,
  }
  const json = JSON.stringify(data)
  return {
    status: 502,
    statusText: "Bad Gateway",
    headers: {
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(json),
      "content-type": "application/json",
    },
    body: json,
  }
}

const originFromUrlOrUrlPattern = (url) => {
  if (url.startsWith("http://")) {
    const slashAfterProtocol = url.indexOf("/", "http://".length + 1)
    if (slashAfterProtocol === -1) {
      return url
    }
    const origin = url.slice(0, slashAfterProtocol)
    return origin
  }
  if (url.startsWith("https://")) {
    const slashAfterProtocol = url.indexOf("/", "https://".length + 1)
    if (slashAfterProtocol === -1) {
      return url
    }
    const origin = url.slice(0, slashAfterProtocol)
    return origin
  }
  if (url.startsWith("file://")) {
    return "file://"
  }
  return new URL(url).origin
}
