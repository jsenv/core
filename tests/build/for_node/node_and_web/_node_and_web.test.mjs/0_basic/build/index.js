import { foo } from "./test_node_modules.js";

const clientHtmlFileUrl = import.meta.resolve("./html/main.html");

console.log(foo);
console.log(clientHtmlFileUrl);
