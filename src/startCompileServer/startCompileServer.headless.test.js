import { startCompileServer } from "./startCompileServer.js"
import { all, fromPromise } from "@dmail/action"
import path from "path"
import puppeteer from "puppeteer"
import test from "@dmail/test"

const startClient = () => {
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

  return fromPromise(
    puppeteer
      .launch({
        ignoreHTTPSErrors: true, // because we use a self signed certificate
        // handleSIGINT: true,
        // handleSIGTERM: true,
        // handleSIGHUP: true,
        // because the 3 above are true by default pupeeter will auto close browser
        // so we apparently don't have to use listenNodeBeforeExit in order to close browser
        // as we do for server
      })
      .then((browser) => {
        return browser.newPage().then((page) => {
          return { browser, page }
        })
      }),
  )
}

const testInBrowser = (filename) => {
  return all([
    startCompileServer({
      rootLocation: `${path.resolve(__dirname, "../../../")}`,
    }),
    startClient(),
  ])
    .then(([server, client]) => {
      return { server, browser: client.browser, page: client.page }
    })
    .then(({ server, browser, page }) => {
      return fromPromise(
        // the thing is that browser will need the specific index.html
        // file used to run what we want to run
        // we need a way to tell the browser what we want to import
        // and we need a way to serve that index.html file
        page.goto(`${server.url}/src/__test__/index.html`).then(() => {
          return page.evaluate(() => {
            /* eslint-disable no-undef */
            System.import(filename)
            /* eslint-enabled no-undef */
          })
        }),
      ).then((value) => {
        return all([server.close(), browser.close()]).then(() => value)
      })
    })
}

test(() => testInBrowser("file.test.js"))
