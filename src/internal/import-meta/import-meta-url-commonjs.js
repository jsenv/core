/* global __filename */

const filenameContainsBackSlashes = __filename.indexOf("\\") > -1

const url = filenameContainsBackSlashes
  ? `file:///${__filename.replace(/\\/g, "/")}`
  : `file://${__filename}`

export default url
