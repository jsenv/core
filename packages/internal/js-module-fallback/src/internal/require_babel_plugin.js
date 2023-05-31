import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const babelPluginPackagePath = require.resolve("@jsenv/transpilation");
const babelPluginPackageUrl = pathToFileURL(babelPluginPackagePath);

export const requireBabelPlugin = createRequire(babelPluginPackageUrl);