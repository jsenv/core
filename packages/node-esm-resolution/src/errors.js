// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473
import { fileURLToPath } from "node:url"

export const createInvalidModuleSpecifierError = ({
  specifier,
  parentUrl,
  reason,
}) => {
  const error = new Error(
    `Invalid module "${specifier}" ${reason} imported from ${fileURLToPath(
      parentUrl,
    )}`,
  )
  error.code = "INVALID_MODULE_SPECIFIER"
  return error
}

export const createInvalidPackageTargetError = ({
  parentUrl,
  packageUrl,
  target,
  key,
  isImport,
  reason,
}) => {
  let message
  if (key === ".") {
    message = `Invalid "exports" main target defined in ${fileURLToPath(
      packageUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`
  } else {
    message = `Invalid "${
      isImport ? "imports" : "exports"
    }" target ${JSON.stringify(target)} defined for "${key}" in ${fileURLToPath(
      packageUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`
  }
  const error = new Error(message)
  error.code = "INVALID_PACKAGE_TARGET"
  return error
}

export const createPackagePathNotExportedError = ({
  subpath,
  parentUrl,
  packageUrl,
}) => {
  let message
  if (subpath === ".") {
    message = `No "exports" main defined in ${fileURLToPath(
      packageUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`
  } else {
    message = `Package subpath "${subpath}" is not defined by "exports" in ${fileURLToPath(
      packageUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`
  }
  const error = new Error(message)
  error.code = "PACKAGE_PATH_NOT_EXPORTED"
  return error
}

export const createModuleNotFoundError = ({ specifier, parentUrl }) => {
  const error = new Error(
    `Cannot find "${specifier}" imported from ${fileURLToPath(parentUrl)}`,
  )
  error.code = "MODULE_NOT_FOUND"
  return error
}

export const createPackageImportNotDefinedError = ({
  specifier,
  packageUrl,
  parentUrl,
}) => {
  const error = new Error(
    `Package import specifier "${specifier}" is not defined in ${fileURLToPath(
      packageUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`,
  )
  error.code = "PACKAGE_IMPORT_NOT_DEFINED"
  return error
}
