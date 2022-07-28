// this file launches a webkit browser, useful to test if dev server works on wekbit

import { webkit } from "playwright"

const browser = await webkit.launch({ headless: false })
const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
await browserContext.newPage()
