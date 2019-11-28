import { launchChromium } from "./launchChromium.js"

export const launchChromiumTab = (namedArgs) => launchChromium({ shareBrowser: true, ...namedArgs })
