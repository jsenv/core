import style from "./src/style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, style]
console.log("adopt style", style)

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    console.log(
      "remove style",
      style,
      document.adoptedStyleSheets.includes(style),
    )
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== style,
    )
  })
}
