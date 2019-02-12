import { hrefToMeta, pathnameToSourceHref } from "../locaters.js"
import { stringToStringWithLink, link } from "../../stringToStringWithLink.js"

export const rejectionValueToMeta = (error, { compileInto, compiledRootHref }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    return parseErrorToMeta(error, { compiledRootHref })
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    const pathname = hrefToMeta(error.url, { compileInto, compiledRootHref }).pathname
    const originalError = error.error
    return {
      file: pathname,
      // eslint-disable-next-line no-use-before-define
      data: rejectionToData(originalError, {
        compileInto,
        pathname,
      }),
    }
  }

  return {
    data: rejectionToData(error),
  }
}

const parseErrorToMeta = (error, { compiledRootHref }) => {
  const file = error.fileName
  const message = error.messageHTML || error.message
  const data = message.replace(
    file,
    link(`${pathnameToSourceHref({ pathname: file, compiledRootHref })}`, file),
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
