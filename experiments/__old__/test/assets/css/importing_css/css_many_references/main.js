/* eslint-env browser */

import css from "./style.css" assert { type: "css" }

const cssUrl = new URL("./style.css", import.meta.url)

export const cssInstanceOfStylesheet = css instanceof CSSStyleSheet

export const cssUrlString = String(cssUrl)
