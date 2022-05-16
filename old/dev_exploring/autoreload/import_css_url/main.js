const cssUrl = new URL("./src/style.css", import.meta.url)

const link = document.createElement("link")
link.rel = "stylesheet"
link.href = cssUrl
document.head.appendChild(link)

if (import.meta.hot) {
  import.meta.hot.accept()
}
