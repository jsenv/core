import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToRessource,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

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

  return {
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
      const { search } = new URL(fileUrl)
      const firstSlashIndex = fileRelativeUrl.indexOf("/")
      const directoryName = fileRelativeUrl.slice(0, firstSlashIndex)
      const origin = originDirectoryConverter.fromDirectoryName(directoryName)
      const pathname = fileRelativeUrl.slice(firstSlashIndex)
      const remoteUrl = `${origin}${pathname}${search}`
      return remoteUrl
    },
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
