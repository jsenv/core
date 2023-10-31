import { enableRerenderOnCustomElementUpdate } from "@jsenv/custom-elements-redefine"; // TODO: find a way to treeshake after build
import "./app/app_custom_element.js";

enableRerenderOnCustomElementUpdate();

document.querySelector("#root").innerHTML = `<my-app></my-app>`;

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    document.querySelector("#root").innerHTML = "";
  });
}
