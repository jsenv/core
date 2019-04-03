import { filenameRelativeToSourceHref } from "../filenameRelativeToSourceHref.js"
import { stringToStringWithLink, link } from "../../stringToStringWithLink.js"

export const rejectionValueToMeta = (error, { compileServerOrigin }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    const parseError = error.parseError

    return {
      file: parseError.fileName,
      importerFile: error.importerFile,
      data: (parseError.messageHMTL || parseError.message).replace(
        parseError.fileName,
        link(
          `${filenameRelativeToSourceHref({
            compileServerOrigin,
            filenameRelative: parseError.fileName,
          })}`,
          parseError.fileName,
        ),
      ),
      dataTheme: "light",
    }
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return {
      file: error.file,
      importerFile: error.importerFile,
      data: rejectionToData(error.error),
    }
  }

  if (error && error.code && error.file) {
    return {
      file: error.file,
      importerFile: error.importerFile,
      data: rejectionToData(error),
    }
  }

  return {
    data: rejectionToData(error),
  }
}

const rejectionToData = (error) => {
  if (error && error instanceof Error) {
    return stringToStringWithLink(error.stack)
  }

  return JSON.stringify(error)
}
