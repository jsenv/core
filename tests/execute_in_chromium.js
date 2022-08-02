import { chromium } from "playwright"

export const executeInChromium = async ({
  url,
  headScriptUrl,
  pageFunction,
  pageArguments = [],
  collectConsole = false,
  collectErrors = false,
  debug = false,
  headless = !debug,
  autoStop = !debug,
}) => {
  const browser = await chromium.launch({ headless })
  const page = await browser.newPage({ ignoreHTTPSErrors: true })

  const pageLogs = []
  page.on("console", (message) => {
    if (collectConsole) {
      pageLogs.push({ type: message.type(), text: message.text() })
    } else if (message.type() === "error") {
      console.error(message.text())
    }
  })

  const pageErrors = []
  page.on("pageerror", (error) => {
    if (collectErrors) {
      pageErrors.push(error)
    } else {
      throw error
    }
  })

  await page.goto(url)
  if (headScriptUrl) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
    await page.addScriptTag({ url: headScriptUrl })
  }
  try {
    const returnValue = await page.evaluate(pageFunction, ...pageArguments)
    return {
      returnValue,
      pageErrors,
      pageLogs,
    }
  } finally {
    if (autoStop) {
      browser.close()
    }
  }
}
