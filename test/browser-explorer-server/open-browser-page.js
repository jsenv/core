const puppeteer = import.meta.require("puppeteer")

export const openBrowserPage = async (url) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(url)
  return { browser, page }
}
