import { external } from "./js/external_dev.js";
import { zExternal } from "./js/z_external_build.js";
// eslint-disable-next-line import-x/no-unresolved
import { internal } from "./js/internal_build.js";
// eslint-disable-next-line import-x/no-unresolved
import { zInternal } from "./js/z_internal_dev.js";

console.log(internal, external, zInternal, zExternal);
