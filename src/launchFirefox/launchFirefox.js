/* eslint-disable */
// to be rewritten, maybe using https://www.npmjs.com/package/puppeteer-firefox ?
// https://www.npmjs.com/package/selenium-webdriver

// http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebDriver.html
// import { Builder } from "selenium-webdriver"
// https://github.com/SeleniumHQ/selenium/blob/master/javascript/node/selenium-webdriver/firefox.js#L34
// import firefox from "selenium-webdriver/firefox"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { openIndexServer } from "../openIndexServer/openIndexServer.js"
import { getBrowserSetupAndTeardowm } from "../getClientSetupAndTeardown.js"

const clientFunction = (file, setupSource, teardownSource, done) => {
  eval(setupSource)(file)
  window.System.import(file)
    .then(eval(teardownSource))
    .then(
      (value) => done({ status: "resolved", value }),
      (value) => done({ status: "rejected", value }),
    )
}

// to update with remoteRoot, remoteCompileFolder, hotreload signature
// also do not force dev-server to have firefox and selenium-webdriver
// this openFirefoxClient will become an external module
export const openFirefoxClient = ({
  compileURL,
  headless = true,
  runFile = ({ driver, file, setup, teardown }) => {
    return driver
      .executeScriptAsync(
        `(${clientFunction.toString()}.apply(this, arguments)`,
        file,
        `(${setup.toString()})`,
        `(${teardown.toString()})`,
      )
      .then(({ status, value }) => {
        return status === "resolved" ? value : Promise.reject(value)
      })
  },
}) => {
  const options = new firefox.Options()
  if (headless) {
    options.headless()
  }

  return new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .build()
    .then((driver) => {
      return createHTMLForBrowser({
        title: "Skeleton for Firefox",
      }).then((indexHTML) => {
        return openIndexServer({
          indexBody: indexHTML,
        }).then((indexRequestHandler) => {
          const execute = ({ file, autoClean = false, collectCoverage = false }) => {
            const remoteFile = getRemoteLocation({
              compileURL,
              file,
            })

            return driver
              .get(indexRequestHandler.origin)
              .then(() =>
                runFile({
                  driver,
                  file: remoteFile,
                  ...getBrowserSetupAndTeardowm({ collectCoverage }),
                }),
              )
              .then(({ status, value }) => {
                if (autoClean) {
                  indexRequestHandler.stop()
                }

                if (status === "resolved") {
                  return value
                }
                return Promise.reject(value)
              })
          }

          const close = () => {
            return driver.quit()
          }

          return { execute, close }
        })
      })
    })
}
