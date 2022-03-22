import { lookupPackageScope } from "./lookup_package_scope.js"
import { readPackageJson } from "./read_package_json.js"

// https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#packages_determining_module_system)
export const determineModuleSystem = (
  url,
  { ambiguousExtensions = [".js"] } = {},
) => {
  const inputTypeArgv = process.execArgv.find((argv) =>
    argv.startsWith("--input-type="),
  )
  if (inputTypeArgv) {
    const value = inputTypeArgv.slice("--input-type=".length)
    if (value === "module") {
      return "module"
    }
    if (value === "commonjs") {
      return "commonjs"
    }
  }
  const extension = extensionFromUrl(url)
  if (extension === ".mjs") {
    return "module"
  }
  if (extension === ".cjs") {
    return "commonjs"
  }
  if (extension === ".json") {
    return "json"
  }
  if (ambiguousExtensions.includes(extension)) {
    const packageUrl = lookupPackageScope(url)
    if (!packageUrl) {
      return "commonjs"
    }
    const packageJson = readPackageJson(packageUrl)
    if (packageJson.type === "module") {
      return "module"
    }
    return "commonjs"
  }
  throw new Error("unsupported file extension")
}

const extensionFromUrl = (url) => {
  const { pathname } = new URL(url)
  const slashLastIndex = pathname.lastIndexOf("/")
  const filename =
    slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1)
  const dotLastIndex = filename.lastIndexOf(".")
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex)
  return extension
}
