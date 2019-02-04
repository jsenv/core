import { hrefToMeta, ressourceToRemoteSourceFile } from "../locaters.js"
import { stringToStringWithLink, link } from "../../stringToStringWithLink.js"

export const rejectionValueToMeta = (error, { remoteRoot, compileInto }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    return parseErrorToMeta(error, { remoteRoot })
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    const file = hrefToMeta(error.url, { remoteRoot, compileInto }).ressource
    const originalError = error.error
    return {
      file,
      // eslint-disable-next-line no-use-before-define
      data: rejectionToData(originalError, {
        remoteRoot,
        compileInto,
      }),
    }
  }

  return {
    data: rejectionToData(error),
  }
}

const parseErrorToMeta = (error, { remoteRoot }) => {
  const file = error.fileName
  const message = error.messageHTML || error.message
  const data = message.replace(
    file,
    link(`${ressourceToRemoteSourceFile({ ressource: file, remoteRoot })}`, file),
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
