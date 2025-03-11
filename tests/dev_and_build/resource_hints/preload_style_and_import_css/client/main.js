import style from "./style.css" with { type: "css" };

document.adoptedStyleSheets = [...document.adoptedStyleSheets, style];

// Let browser time to log an eventual warning about preload link not used
await new Promise((resolve) => {
  setTimeout(resolve, 5000);
});
window.resolveResultPromise(getComputedStyle(document.body).fontSize);
