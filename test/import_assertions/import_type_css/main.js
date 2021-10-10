/* eslint-env browser */

import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

export const backgroundBodyColor = getComputedStyle(
  document.body,
).backgroundColor
