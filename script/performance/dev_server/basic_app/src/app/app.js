/**
 * The actual app UI, very simplified of course
 */

import { greet } from "../app/greet.js"

const app = document.querySelector("#app")

export const render = () => {
  const logoUrl = new URL("../logo.png", import.meta.url)

  app.innerHTML = `
<img src=${logoUrl} width="64" height="64" alt="jsenv logo" />
<p>${greet()}</p>`
}
