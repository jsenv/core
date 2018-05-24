import { startCompileServer } from "./startCompileServer.js"
import path from "path"
import puppeteer from "puppeteer"
import { createSignal } from "@dmail/signal"

const createExecuteFileOnBrowser = ({ serverURL }) => {
  const indexFile = `${serverURL}src/__test__/index.html`

  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()

    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
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
          return page.goto(indexFile).then((file) => {
            // eslint-disable-next-line no-undef
            return page.evaluate(System.import(file))
          }, file)
        })
      })
      .then(
        () => {
          ended.emit()
        },
        (reason) => {
          crashed.emit(reason)
        },
      )

    return { ended, crashed }
  }

  return { execute }
}

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnBrowser({ serverURL: url })

    const execution = execute("./src/__test__/file.test.js")

    execution.ended.listen(close)
  },
)
