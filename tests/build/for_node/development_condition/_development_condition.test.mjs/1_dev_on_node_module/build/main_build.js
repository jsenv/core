import { bar } from "./test_packages.js";
import { foo } from "./test_node_modules.js";

// eslint-disable-next-line import-x/no-unresolved

console.log(foo, bar);
