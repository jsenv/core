import { chromium } from "playwright"

export const executeInChromium = async ({
  url,
  headScriptUrl,
  pageFunction,
  pageArguments = [],
  collectConsole = true,
  collectErrors = true,
  debug = false,
  headless = !debug,
  autoStop = !debug,
}) => {
  const browser = await chromium.launch({
    headless,
  })
  const page = await browser.newPage({ ignoreHTTPSErrors: true })

  const pageLogs = []
  if (collectConsole) {
    page.on("console", (message) => {
      pageLogs.push({ type: message.type(), text: message.text() })
    })
  }
  const pageErrors = []
  if (collectErrors) {
    page.on("pageerror", (error) => {
      pageErrors.push(error)
    })
  }

  await page.goto(url)
  if (headScriptUrl) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
    await page.addScriptTag({
      url: headScriptUrl,
    })
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
