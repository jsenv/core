import { defaultLookupPackageScope } from "./default_lookup_package_scope.js";
import { defaultReadPackageJson } from "./default_read_package_json.js";

// https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#packages_determining_module_system)
export const determineModuleSystem = (
  url,
  { ambiguousExtensions = [".js"] } = {},
) => {
  const inputTypeArgv = process.execArgv.find((argv) =>
    argv.startsWith("--input-type="),
  );
  if (inputTypeArgv) {
    const value = inputTypeArgv.slice("--input-type=".length);
    if (value === "module") {
      return "module";
    }
    if (value === "commonjs") {
      return "commonjs";
    }
  }
  const extension = extensionFromUrl(url);
  if (extension === ".mjs") {
    return "module";
  }
  if (extension === ".cjs") {
    return "commonjs";
  }
  if (extension === ".json") {
    return "url";
  }
  if (ambiguousExtensions.includes(extension)) {
    const packageDirectoryUrl = defaultLookupPackageScope(url);
    if (!packageDirectoryUrl) {
      return "commonjs";
    }
    const packageJson = defaultReadPackageJson(packageDirectoryUrl);
    if (packageJson.type === "module") {
      return "module";
    }
    return "commonjs";
  }
  return "url";
  // throw new Error(`unsupported file extension (${extension})`)
};

const extensionFromUrl = (url) => {
  const { pathname } = new URL(url);
  const slashLastIndex = pathname.lastIndexOf("/");
  const filename =
    slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};
