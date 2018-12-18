import { ressourceToExtension } from "../urlHelper.js"

const contentTypeDefault = "application/octet-stream"

const extensionToContentTypeMap = {
  // text
  txt: "text/plain",
  html: "text/html",
  css: "text/css",
  appcache: "text/cache-manifest",
  // application
  js: "application/javascript",
  json: "application/json",
  map: "application/json",
  xml: "application/xml",
  gz: "application/x-gzip",
  zip: "application/zip",
  pdf: "application/pdf",
  // image
  png: "image/png",
  gif: "image/gif",
  jpg: "image/jpeg",
  // audio
  mp3: "audio/mpeg",
}

export const ressourceToContentType = (ressource) => {
  const extension = ressourceToExtension(ressource)

  if (extension in extensionToContentTypeMap) {
    return extensionToContentTypeMap[extension]
  }

  return contentTypeDefault
}
