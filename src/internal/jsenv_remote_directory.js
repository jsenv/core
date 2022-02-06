import { fetchFileSystem } from "@jsenv/server"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToRessource,
  normalizeStructuredMetaMap,
  urlToMeta,
  writeFile,
} from "@jsenv/filesystem"
import { validateResponseIntegrity } from "@jsenv/integrity"

import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"

import { originDirectoryConverter } from "./origin_directory_converter.js"

export const createJsenvRemoteDirectory = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  preservedUrls,
}) => {
  const jsenvRemoteDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}.remote/`
  const structuredMetaMap = normalizeStructuredMetaMap(
    { preserved: preservedUrls },
    projectDirectoryUrl,
  )
  const isPreservedUrl = (url) => {
    const meta = urlToMeta({ url, structuredMetaMap })
    return Boolean(meta.preserved)
  }

  const jsenvRemoteDirectory = {
    isPreservedUrl,

    isRemoteUrl: (url) => {
      return url.startsWith("http://") || url.startsWith("https://")
    },

    isFileUrlForRemoteUrl: (url) => {
      return urlIsInsideOf(url, jsenvRemoteDirectoryUrl)
    },

    fileUrlFromRemoteUrl: (remoteUrl) => {
      const origin = originFromUrlOrUrlPattern(remoteUrl)
      const ressource = urlToRessource(remoteUrl)
      const [pathname, search = ""] = ressource.split("?")
      const directoryName = originDirectoryConverter.toDirectoryName(origin)
      const fileRelativeUrl = `${directoryName}${
        pathname === "" ? "/" : pathname
      }`
      const fileUrl = `${jsenvRemoteDirectoryUrl}${fileRelativeUrl}${search}`
      return fileUrl
    },

    remoteUrlFromFileUrl: (fileUrl) => {
      const fileRelativeUrl = urlToRelativeUrl(fileUrl, jsenvRemoteDirectoryUrl)
      const firstSlashIndex = fileRelativeUrl.indexOf("/")
      const directoryName = fileRelativeUrl.slice(0, firstSlashIndex)
      const origin = originDirectoryConverter.fromDirectoryName(directoryName)
      const ressource = fileRelativeUrl.slice(firstSlashIndex)
      const remoteUrlObject = new URL(ressource, origin)
      remoteUrlObject.searchParams.delete("integrity")
      const remoteUrl = remoteUrlObject.href
      return remoteUrl
    },

    // The original file might be behind an http url.
    // In that case jsenv try first to read file from filesystem
    // in ".jsenv/.http/" directory. If not found, the url
    // is fetched and file is written in that ".jsenv/.http/" directory.
    // After that the only way to re-fetch this ressource is
    // to delete the content of ".jsenv/.http/"
    fetchUrl: async (url, { request, projectFileCacheStrategy }) => {
      const fromFileSystem = () =>
        fetchFileSystem(url, {
          headers: request.headers,
          etagEnabled: projectFileCacheStrategy === "etag",
          mtimeEnabled: projectFileCacheStrategy === "mtime",
        })
      const filesystemResponse = await fromFileSystem()
      if (
        filesystemResponse.status !== 404 ||
        !jsenvRemoteDirectory.isFileUrlForRemoteUrl(url)
      ) {
        return filesystemResponse
      }
      const urlObject = new URL(url)
      const integrity = urlObject.searchParams.get("integrity")
      if (integrity) {
        urlObject.searchParams.delete("integrity")
      }
      const remoteUrl = jsenvRemoteDirectory.remoteUrlFromFileUrl(
        urlObject.href,
      )
      const requestHeadersToForward = { ...request.headers }
      delete requestHeadersToForward.host
      const response = await fetchUrl(remoteUrl, {
        mode: "cors",
        headers: requestHeadersToForward,
      })
      if (response.status !== 200) {
        return createBadGatewayResponse({
          code: "UNEXPECTED_STATUS",
          message: `unexpected status for ressource "${remoteUrl}", received ${response.status}`,
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
      await writeFile(url, responseBodyAsBuffer)
      // re-fetch filesystem instead to ensure response headers are correct
      return fromFileSystem()
    },
  }

  return jsenvRemoteDirectory
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
