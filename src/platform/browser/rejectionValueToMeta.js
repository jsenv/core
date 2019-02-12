import { hrefToFilenameRelative } from "../hrefToFilenameRelative.js"
import { filenameRelativeToSourceHref } from "../filenameRelativeToSourceHref.js"
import { stringToStringWithLink, link } from "../../stringToStringWithLink.js"

export const rejectionValueToMeta = (error, { compileInto, compileServerOrigin }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    return parseErrorToMeta(error, { compileServerOrigin })
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    const filenameRelative = hrefToFilenameRelative(error.url, { compileInto, compileServerOrigin })
    const originalError = error.error
    return {
      file: filenameRelative,
      // eslint-disable-next-line no-use-before-define
      data: rejectionToData(originalError, {
        compileInto,
        filenameRelative,
      }),
    }
  }

  return {
    data: rejectionToData(error),
  }
}

const parseErrorToMeta = (error, { compileServerOrigin }) => {
  const file = error.fileName
  const message = error.messageHTML || error.message
  const data = message.replace(
    file,
    link(`${filenameRelativeToSourceHref({ compileServerOrigin, filenameRelative: file })}`, file),
  )

  return {
    file,
    data,
    dataTheme: "light",
  }
}

const rejectionToData = (error) => {
  if (error && error instanceof Error) {
    return stringToStringWithLink(error.stack)
  }

  return JSON.stringify(error)
}
