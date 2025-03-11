import { answer } from "./question.js";

console.log(answer);

if (import.meta.hot) {
  import.meta.hot.accept();
}

if (import.meta.dev) {
  console.log("dev");
}
if (import.meta.build) {
  console.log("build");
}
