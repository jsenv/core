import "./app/custom_element_allow_override.js";
import "./app/app_custom_element.js";

document.querySelector("#root").innerHTML = `<my-app></my-app>`;

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    document.querySelector("#root").innerHTML = "";
  });
}
