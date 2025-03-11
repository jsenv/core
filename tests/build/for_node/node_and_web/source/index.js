import { foo } from "foo";

const clientHtmlFileUrl = import.meta.resolve("./client/main.html");

console.log(foo);
console.log(clientHtmlFileUrl);
