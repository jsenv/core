import { fileURLToPath } from "node:url"

export const createInvalidModuleSpecifierError = ({
  specifier,
  parentUrl,
  reason,
}) => {
  const error = new Error(
    `Invalid module specifier "${specifier}" in ${fileURLToPath(
      parentUrl,
    )}: ${reason}`,
  )
  error.code = "INVALID_MODULE_SPECIFIER"
  return error
}

export const createModuleNotFoundError = ({ specifier, parentUrl }) => {
  const error = new Error(
    `Cannot find module "${specifier}" imported by ${fileURLToPath(parentUrl)}`,
  )
  error.code = "MODULE_NOT_FOUND"
  return error
}

export const createPackageImportNotDefinedError = ({
  specifier,
  parentUrl,
}) => {
  const error = new Error(
    `Imports not defined for "${specifier}" imported by ${fileURLToPath(
      parentUrl,
    )}`,
  )
  error.code = "PACKAGE_IMPORT_NOT_DEFINED"
  return error
}
