import "./app/app_custom_element.js";

document.querySelector("#root").innerHTML = `<my-app></my-app>`;

if (import.meta.hot) {
  import("@jsenv/custom-elements-redefine");
  import.meta.hot.accept(() => {
    document.querySelector("#root").innerHTML = "";
  });
}
