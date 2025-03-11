import { foo } from "./js/vendors.js";

const clientHtmlFileUrl = import.meta.resolve("./main.html");

console.log(foo);
console.log(clientHtmlFileUrl);
