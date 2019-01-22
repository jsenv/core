import { stringToStringWithLink, link } from "../../stringToStringWithLink.js"

export const rejectionValueToMeta = (error, { fileToRemoteSourceFile, hrefToFile }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    return parseErrorToMeta(error, { fileToRemoteSourceFile })
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    const file = hrefToFile(error.url)
    const originalError = error.error
    return {
      file,
      // eslint-disable-next-line no-use-before-define
      data: rejectionToData(originalError, {
        fileToRemoteSourceFile,
        hrefToFile,
      }),
    }
  }

  return {
    data: rejectionToData(error),
  }
}

const parseErrorToMeta = (error, { fileToRemoteSourceFile }) => {
  const file = error.data.fileName
  const message = error.data.messageHTML || error.data.message
  const data = message.replace(file, link(`${fileToRemoteSourceFile(file)}`, file))

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
