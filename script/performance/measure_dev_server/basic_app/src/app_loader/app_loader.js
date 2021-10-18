/**
 * This is where you can orchestrate the loading of your application
 */

import { loadCSSAndFonts, nextIDLEPromise } from "./app_loader_utils.js"

export const loadApp = async () => {
  // try to load CSS + get the main fonts before displaying any text
  // to avoid font swapping if possible
  // give max 400ms for this
  const appLoaderCssPromise = loadCSSAndFonts(
    new URL("./app_loader.css", import.meta.url),
    {
      timeout: 400,
      onCssReady: () => {},
      onFontsReady: () => {},
    },
  )
  // start importing app right away
  const appPromise = importApp({
    onJsReady: () => {},
  })
  const appCSSPromise = loadCSSAndFonts(
    new URL("../app/app.css", import.meta.url),
    {
      onCssReady: () => {},
    },
  )

  await appLoaderCssPromise

  const app = await appPromise
  app.render()
  await appCSSPromise
  // app.render() can be very expensive so we wait a bit
  // to let navigator an opportunity to cooldown
  // This should help to save battery power and RAM
  await nextIDLEPromise()
}

const importApp = async ({ onJsReady = () => {} }) => {
  const app = await import("../app/app.js")
  onJsReady()
  return app
}
