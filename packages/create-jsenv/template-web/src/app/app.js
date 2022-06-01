import appStyleSheet from "./app.css" assert { type: "css" };

document.adoptedStyleSheets = [...document.adoptedStyleSheets, appStyleSheet];

const jsenvLogoUrl = new URL("/src/jsenv_logo.svg", import.meta.url);

document.querySelector("#app").innerHTML = `
  <h1>Hello world!</h1>
  <img class="app_logo" src=${jsenvLogoUrl} className="app_logo" alt="logo" />
  <p>
    Edit <code>jsenv_logo.svg</code> and save to test HMR updates.
  </p>
  <a href="https://github.com/jsenv/jsenv-core" target="_blank">Documentation</a>
`;

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    document.querySelector("#app").innerHTML = "";
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== appStyleSheet,
    );
  });
}
