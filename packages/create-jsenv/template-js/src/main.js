import stylesheet from "./main.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet]

document.querySelector("#app").innerHTML = `
  <h1>Hello world!</h1>
  <a href="https://github.com/jsenv/jsenv-core" target="_blank">Documentation</a>
`

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    )
  })
}
