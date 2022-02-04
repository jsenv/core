import { title, linkText } from "./vars.js"

const render = ({ title, linkText }) => {
  document.querySelector("#app").innerHTML = `
  <h1>${title}</h1>
  <a href="https://github.com/jsenv/jsenv-core" target="_blank">${linkText}</a>
`
}

render({ title, linkText })

if (import.meta.hot) {
  import.meta.hot.accept()
}
