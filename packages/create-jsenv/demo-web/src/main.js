import mainStyleSheet from "./main.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, mainStyleSheet]

const jsenvLogoUrl = new URL("/jsenv_logo.svg", import.meta.url)

document.querySelector("#root").innerHTML = `
  <h1>Hello world!</h1>
  <img class="logo" src=${jsenvLogoUrl} alt="logo" />
  <p>
    Edit <code>jsenv_logo.svg</code> and save to test HMR updates.
  </p>
  <a href="https://github.com/jsenv/jsenv-core" target="_blank">Documentation</a>
`

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    document.querySelector("#app").innerHTML = ""
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== mainStyleSheet,
    )
  })
}
