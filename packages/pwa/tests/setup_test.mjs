import { chromium } from "playwright"
import { requestCertificate } from "@jsenv/https-local"
import { startDevServer } from "@jsenv/core"

export const setupTest = async ({ debug, ...rest }) => {
  const { certificate, privateKey } = requestCertificate()
  const testServer = await startDevServer({
    logLevel: "warn",
    protocol: "https",
    certificate,
    privateKey,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: debug,
    clientAutoreload: false,
    supervisor: false,
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
