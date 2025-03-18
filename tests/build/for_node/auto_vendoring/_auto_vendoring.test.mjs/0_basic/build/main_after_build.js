import { nodePackageA } from "./js/node-package-a_index.js";
import { nodePackageB } from "./js/node-package-b_index.js";
// eslint-disable-next-line import-x/no-unresolved
import { workspacePackageA } from "./js/workspace-package-a_index.js";
// eslint-disable-next-line import-x/no-unresolved
import { workspacePackageB } from "./js/workspace-package-b_index.js";

console.log(nodePackageA.toUpperCase());
console.log(nodePackageB.toUpperCase());
console.log(workspacePackageA.toUpperCase());
console.log(workspacePackageB.toUpperCase());
