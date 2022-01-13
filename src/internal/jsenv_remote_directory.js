// TODO: internalize external url converter

import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/filesystem"

import { externalUrlConverter } from "./compiling/external_url_converter.js"

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
      const fileRelativeUrl = externalUrlConverter.toFileRelativeUrl(remoteUrl)
      const { search } = new URL(remoteUrl)
      const fileUrl = `${jsenvRemoteDirectoryUrl}${fileRelativeUrl}${search}`
      return fileUrl
    },

    remoteUrlFromFileUrl: (fileUrl) => {
      const fileRelativeUrl = urlToRelativeUrl(fileUrl, jsenvRemoteDirectoryUrl)
      const { search } = new URL(fileUrl)
      const remoteUrl = `${externalUrlConverter.fromFileRelativeUrl(
        fileRelativeUrl,
      )}${search}`
      return remoteUrl
    },
  }
}
