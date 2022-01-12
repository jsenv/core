import { urlToOrigin, urlToRessource } from "@jsenv/filesystem"
import { originDirectoryConverter } from "./origin_directory_converter.js"

export const externalUrlConverter = {
  toFileRelativeUrl: (externalUrl) => {
    const origin = urlToOrigin(externalUrl)
    const ressource = urlToRessource(externalUrl)
    const [pathname] = ressource.split("?")
    const directoryName = originDirectoryConverter.toDirectoryName(origin)
    const fileRelativeUrl = `${directoryName}${pathname}`
    return fileRelativeUrl
  },

  fromFileRelativeUrl: (fileRelativeUrl) => {
    const firstSlashIndex = fileRelativeUrl.indexOf("/")
    const directoryName = fileRelativeUrl.slice(0, firstSlashIndex)
    const origin = originDirectoryConverter.fromDirectoryName(directoryName)
    const pathname = fileRelativeUrl.slice(firstSlashIndex)
    return `${origin}${pathname}`
  },
}
