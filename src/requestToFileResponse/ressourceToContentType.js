// https://github.com/jshttp/mime-db/blob/master/src/apache-types.json

import { ressourceToExtension } from "../urlHelper.js"
import contentTypeMap from "./contentTypeMap.json"

const contentTypeDefault = "application/octet-stream"

export const ressourceToContentType = (ressource) => {
  const extension = ressourceToExtension(ressource)

  const contentTypeForExtension = Object.keys(contentTypeMap).find((contentTypeName) => {
    const contentType = contentTypeMap[contentTypeName]
    return contentType.extensions && contentTypeMap.extensions.indexOf(extension) > -1
  })

  return contentTypeForExtension || contentTypeDefault
}
