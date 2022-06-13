import { createRequire } from "node:module";

const require = createRequire(import.meta.url); // eslint-disable-next-line import/no-dynamic-require


export const requireBabelPlugin = name => require(name);
export { getBabelHelperFileUrl, babelHelperNameFromUrl } from "./babel_helper_directory.js";