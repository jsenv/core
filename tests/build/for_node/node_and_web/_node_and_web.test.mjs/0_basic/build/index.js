import { foo } from "./test_node_modules.js";

const clientHtmlFileUrl = import.meta.resolve("./client/toto/main.html");

console.log(foo);
console.log(clientHtmlFileUrl);
