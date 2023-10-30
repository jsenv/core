import "./app/app_custom_element.js";

const AppCustomElement = customElements.get("my-app");

const jsenvLogoUrl = new URL("/jsenv_logo.svg", import.meta.url);
const appCustomElement = new AppCustomElement({
  logoUrl: jsenvLogoUrl,
});
document.querySelector("#root").appendChild(appCustomElement);

if (import.meta.hot) {
  // custom element registry is not compatible with hot reload
  // (would have to proxy all custom elements to update them on reload)
  import.meta.hot.decline();
}
