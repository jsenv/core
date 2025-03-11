import { nodePackageA } from "node-package-a";
import { nodePackageB } from "node-package-b";
// eslint-disable-next-line import-x/no-unresolved
import { workspacePackageA } from "workspace-package-a";
// eslint-disable-next-line import-x/no-unresolved
import { workspacePackageB } from "workspace-package-b";

console.log(nodePackageA.toUpperCase());
console.log(nodePackageB.toUpperCase());
console.log(workspacePackageA.toUpperCase());
console.log(workspacePackageB.toUpperCase());
