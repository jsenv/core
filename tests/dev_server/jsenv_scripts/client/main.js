import { value } from "./a.js";

document.querySelector("#app").innerHTML = value;

if (import.meta.hot) {
  import.meta.hot.accept();
}
