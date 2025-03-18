import { nodePackageA, nodePackageB } from "./test_node_modules.js";
import { workspacePackageA, workspacePackageB } from "./test_packages.js";

console.log(nodePackageA.toUpperCase());
console.log(nodePackageB.toUpperCase());
console.log(workspacePackageA.toUpperCase());
console.log(workspacePackageB.toUpperCase());
