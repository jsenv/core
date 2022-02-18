import style from "./src/style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, style]

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== style,
    )
  })
}
