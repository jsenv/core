import { fileToRemoteSourceFile, remoteCompiledFileToFile } from "./server.js"
import { stringToStringWithLink, link } from "./stringToStringWithLink.js"

const parseErrorToMeta = (error) => {
  const parseError = JSON.parse(error.body)
  const file = parseError.fileName
  const message = parseError.message
  const data = message.replace(file, link(`${fileToRemoteSourceFile(file)}`, file))

  return {
    file,
    data,
  }
}

const instantiateErrorToMeta = (error) => {
  const file = remoteCompiledFileToFile(error.url) // to be tested
  const originalError = error.error
  return {
    file,
    // eslint-disable-next-line no-use-before-define
    data: rejectionValueToMeta(originalError),
  }
}

const errorToMeta = (error) => {
  return {
    data: stringToStringWithLink(error.stack),
  }
}

export const rejectionValueToMeta = ({ error }) => {
  if (error && error.status === 500 && error.reason === "parse error") {
    return parseErrorToMeta(error)
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return instantiateErrorToMeta(error)
  }

  if (error && error instanceof Error) {
    return errorToMeta(error)
  }

  return {
    data: JSON.stringify(error),
  }
}
