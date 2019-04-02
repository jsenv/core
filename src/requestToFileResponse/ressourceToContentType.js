// https://github.com/jshttp/mime-db/blob/master/src/apache-types.json

import { ressourceToExtension } from "../urlHelper.js"

// currently jsenv seems to fail to load .json, to be fixed
// for now we use import.meta.require to fix
const contentTypeMap = import.meta.require("./contentTypeMap.json")

const availableContentTypes = Object.keys(contentTypeMap)
const contentTypeDefault = "application/octet-stream"

export const ressourceToContentType = (ressource) => {
  const extension = ressourceToExtension(ressource)

  const contentTypeForExtension = availableContentTypes.find((contentTypeName) => {
    const contentType = contentTypeMap[contentTypeName]
    return contentType.extensions && contentType.extensions.indexOf(extension) > -1
  })

  return contentTypeForExtension || contentTypeDefault
}
