import { url } from "http://127.0.0.1:9999/file.js";
import { answer } from "./dep.js";

console.log(url, answer);
window.resolveResultPromise({ url, answer });
