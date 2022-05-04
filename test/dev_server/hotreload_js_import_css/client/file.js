import style from "./style.css" assert { type: "css" }

const updateStylesheet = (label, callback) => {
  const adoptedStyleheetCount = document.adoptedStyleSheets.length
  if (label === "add") console.log("adding stylesheet")
  if (label === "remove") console.log("remove stylesheet")
  if (label === "add" && adoptedStyleheetCount !== 0) {
    console.warn(
      `${adoptedStyleheetCount} unexpected stylesheets found before adding`,
    )
  }
  callback()
  const newAdoptedStyleheetCount = document.adoptedStyleSheets.length
  if (label === "remove" && newAdoptedStyleheetCount !== 0) {
    console.warn(
      `${newAdoptedStyleheetCount} unexpected stylesheets left in document after remove`,
    )
  }
}

updateStylesheet("add", () => {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, style]
})
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    updateStylesheet("remove", () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== style,
      )
    })
  })
}
