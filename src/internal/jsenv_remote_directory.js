import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToOrigin,
  urlToRessource,
} from "@jsenv/filesystem"

import { originDirectoryConverter } from "./origin_directory_converter.js"

export const createJsenvRemoteDirectory = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
}) => {
  const jsenvRemoteDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}.remote/`

  return {
    isRemoteUrl: (url) => {
      return url.startsWith("http://") || url.startsWith("https://")
    },

    isFileUrlForRemoteUrl: (url) => {
      return urlIsInsideOf(url, jsenvRemoteDirectoryUrl)
    },

    fileUrlFromRemoteUrl: (remoteUrl) => {
      const origin = urlToOrigin(remoteUrl)
      const ressource = urlToRessource(remoteUrl)
      const [pathname] = ressource.split("?")
      const directoryName = originDirectoryConverter.toDirectoryName(origin)
      const fileRelativeUrl = `${directoryName}${pathname}`
      const { search } = new URL(remoteUrl)
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
