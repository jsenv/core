import { chromium } from "playwright"
import { startTestServer } from "./start_test_server.mjs"

export const setupTest = async ({ debug, ...rest }) => {
  const testServer = await startTestServer({
    keepProcessAlive: debug,
    ...rest,
  })
  const browser = await chromium.launch({
    headless: !debug,
  })
  const page = await launchBrowserPage(browser)

  return { testServer, browser, page }
}

const launchBrowserPage = async (browser) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text())
    }
  })
  page.on("pageerror", (error) => {
    throw error
  })
  return page
}
