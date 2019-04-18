// https://github.com/jshttp/mime-db/blob/master/src/apache-types.json

import { ressourceToExtension } from "../urlHelper.js"
import contentTypeMap from "./contentTypeMap.js"

const availableContentTypes = Object.keys(contentTypeMap)
const contentTypeDefault = "application/octet-stream"

export const filenameToContentType = (filename) => {
  const extension = ressourceToExtension(filename)

  const contentTypeForExtension = availableContentTypes.find((contentTypeName) => {
    const contentType = contentTypeMap[contentTypeName]
    return contentType.extensions && contentType.extensions.indexOf(extension) > -1
  })

  return contentTypeForExtension || contentTypeDefault
}
