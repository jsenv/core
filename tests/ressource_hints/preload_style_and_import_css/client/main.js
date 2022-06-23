import style from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, style]

// Let browser time to log an eventual warning about preload link not used
await new Promise((resolve) => {
  setTimeout(resolve, 5000)
})
window.resolveResultPromise({
  fontSize: getComputedStyle(document.body).fontSize,
})
