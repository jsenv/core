import "./app/custom_elements_redefine.js";
import "./app/app_custom_element.js";

document.querySelector("#root").innerHTML = `<my-app></my-app>`;

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    document.querySelector("#root").innerHTML = "";
  });
}
