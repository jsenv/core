import { value } from "./a.js";

document.body.innerHTML = value;

if (import.meta.hot) {
  import.meta.hot.accept();
}
