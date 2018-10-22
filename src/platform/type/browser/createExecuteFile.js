import { stringToStringWithLink, link } from "./stringToStringWithLink.js"

const parseErrorToMeta = (error, { fileToRemoteSourceFile }) => {
  const parseError = JSON.parse(error.body)
  const file = parseError.fileName
  const message = parseError.message
  const data = message.replace(file, link(`${fileToRemoteSourceFile(file)}`, file))

  return {
    file,
    data,
  }
}

const errorToMeta = (error) => {
  return {
    data: stringToStringWithLink(error.stack),
  }
}

export const createExecuteFile = ({
  markFileAsImported,
  fileToRemoteCompiledFile,
  fileToRemoteSourceFile,
  remoteCompiledFileToFile,
}) => {
  const rejectionValueToMeta = ({ error }) => {
    if (error && error.status === 500 && error.reason === "parse error") {
      return parseErrorToMeta(error, { fileToRemoteSourceFile })
    }

    if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
      const file = remoteCompiledFileToFile(error.url) // to be tested
      const originalError = error.error
      return {
        file,
        // eslint-disable-next-line no-use-before-define
        data: rejectionValueToMeta(originalError),
      }
    }

    if (error && error instanceof Error) {
      return errorToMeta(error)
    }

    return {
      data: JSON.stringify(error),
    }
  }

  return (file) => {
    markFileAsImported(file)

    const remoteCompiledFile = fileToRemoteCompiledFile(file)

    return window.System.import(remoteCompiledFile).catch((error) => {
      const meta = rejectionValueToMeta(error)

      document.body.innerHTML = `<h1><a href="${fileToRemoteSourceFile(
        file,
      )}">${file}</a> import rejected</h1>
	<pre style="border: 1px solid black">${meta.data}</pre>`

      return Promise.reject(error)
    })
  }
}
