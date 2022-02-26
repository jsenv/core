import { fileURLToPath } from "node:url"

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
