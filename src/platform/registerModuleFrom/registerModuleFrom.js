import { hrefToFilenameRelative } from "../hrefToFilenameRelative.js"
import { createModuleNotFoundError } from "./error/module-not-found-error.js"
import { createModuleParseError } from "./error/module-parse-error.js"
import { createModuleResponseUnsupportedStatusError } from "./error/module-response-unsupported-status-error.js"
import { createModuleResponseMissingContentTypeHeaderError } from "./error/module-response-missing-content-type-header-error.js"
import { createModuleInstantiateError } from "./error/module-instantiate-error.js"
import { createModuleResponseUnsupportedContentTypeHeaderError } from "./error/module-response-unsupported-content-type-header-error.js"

export const fromHref = async ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
  href,
  importer,
}) => {
  const { url, status, statusText, headers, body } = await fetchSource({
    href,
    importer,
  })
  const realHref = url
  const { file, importerFile } = computeFileAndImporterFile({
    href,
    importer,
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
  })

  if (status === 404) {
    throw createModuleNotFoundError({
      file,
      importerFile,
    })
  }

  if (status === 500 && statusText === "parse error") {
    throw createModuleParseError({ file, importerFile, parseError: JSON.parse(body) })
  }

  if (status < 200 || status >= 300) {
    throw createModuleResponseUnsupportedStatusError({
      file,
      importerFile,
      href: realHref,
      status,
      statusText,
    })
  }

  if ("content-type" in headers === false) {
    throw createModuleResponseMissingContentTypeHeaderError({ file, importerFile, href: realHref })
  }

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningRegisteredModule(
      () => {
        return moduleSourceToSystemRegisteredModule(body, {
          compileInto,
          sourceOrigin,
          compileServerOrigin,
          href: realHref,
          importer,
          platformSystem,
        })
      },
      { file, importerFile },
    )
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: JSON.parse(body),
        }
      },
      { file, importerFile },
    )
  }

  throw createModuleResponseUnsupportedContentTypeHeaderError({
    file,
    importerFile,
    href: realHref,
    contentType,
  })
}

export const computeFileAndImporterFile = ({
  href,
  importer,
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
}) => {
  const file = hrefToFilenameRelative(href, {
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
  })
  const importerFile = importer
    ? hrefToFilenameRelative(importer, {
        compileInto,
        sourceOrigin,
        compileServerOrigin,
        compileId,
      })
    : undefined
  return { file, importerFile }
}

const fromFunctionReturningRegisteredModule = (fn, { file, importerFile }) => {
  try {
    return fn()
  } catch (error) {
    return Promise.reject(
      createModuleInstantiateError({ file, importerFile, instantiateError: error }),
    )
  }
}

export const fromFunctionReturningNamespace = (fn, { file, importerFile }) => {
  return fromFunctionReturningRegisteredModule(
    () => {
      // should we compute the namespace here
      // or as it is done below, defer to execute ?
      // I think defer to execute is better
      return [
        [],
        (_export) => {
          return {
            execute: () => {
              _export(fn())
            },
          }
        },
      ]
    },
    { file, importerFile },
  )
}
