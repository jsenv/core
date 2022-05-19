import { chromium } from "playwright"
import { readFile, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/plugin-preact"

const countLabelJsxFileUrl = new URL(
  "./client/count_label.jsx",
  import.meta.url,
)
const countLabelJsxFileContent = {
  beforeTest: await readFile(countLabelJsxFileUrl),
  update: (content) => writeFile(countLabelJsxFileUrl, content),
  restore: () =>
    writeFile(countLabelJsxFileUrl, countLabelJsxFileContent.beforeTest),
}

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  autoreload: {
    cooldownBetweenFileEvents: 250,
  },
  plugins: [jsenvPluginPreact()],
})
const browser = await chromium.launch({
  headless: true,
})
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${devServer.origin}/main.html`)
  await page.evaluate(
    /* eslint-disable no-undef */
    () => window.readyPromise,
    /* eslint-enable no-undef */
  )
  const getCountLabelText = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return document.querySelector("#count_label").innerHTML
      },
      /* eslint-enable no-undef */
    )
  }
  const increase = () => {
    return page.click("#button_increase")
  }

  {
    await increase()
    const actual = {
      countLabelText: await getCountLabelText(),
    }
    const expected = {
      countLabelText: "toto: 1",
    }
    assert({ actual, expected })
  }
  await countLabelJsxFileContent.update(`
export const CountLabel = ({ count }) => {
  return (
    <span id="count_label" style="color: black">
      tata: {count}
    </span>
  )
}`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  {
    const actual = {
      countLabelText: await getCountLabelText(),
    }
    const expected = {
      countLabelText: "tata: 1",
    }
    assert({ actual, expected })
  }
  {
    await increase()
    const actual = {
      countLabelText: await getCountLabelText(),
    }
    const expected = {
      countLabelText: "tata: 2",
    }
    assert({ actual, expected })
  }
} finally {
  browser.close()
  countLabelJsxFileContent.restore()
}
