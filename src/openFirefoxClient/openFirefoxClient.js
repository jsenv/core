// https://www.npmjs.com/package/selenium-webdriver

// http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebDriver.html
import { Builder } from "selenium-webdriver"
// https://github.com/SeleniumHQ/selenium/blob/master/javascript/node/selenium-webdriver/firefox.js#L34
import firefox from "selenium-webdriver/firefox"
import { createBrowserIndexHTML } from "../createBrowserIndexHTML.js"
import { openIndexServer } from "../openIndexServer/openIndexServer.js"
import { getRemoteLocation } from "../getRemoteLocation.js"

const clientFunction = (file, setup, teardown, done) => {
  setup(file)
  window.System.import(file)
    .then(teardown)
    .then(
      (value) => done({ status: "resolved", value }),
      (value) => done({ status: "rejected", value }),
    )
}

export const openFirefoxClient = ({
  server,
  headless = true,
  runFile = ({ driver, file, setup, teardown }) => {
    return driver
      .executeScriptAsync(
        `(${clientFunction.toString()}.apply(this, arguments)`,
        file,
        setup,
        teardown,
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
      return openIndexServer({
        indexBody: createBrowserIndexHTML({
          loaderSrc: `${server.url}node_modules/@dmail/module-loader/src/browser/index.js`,
        }),
      }).then((indexRequestHandler) => {
        const execute = ({ file, autoClean = false, collectCoverage = false }) => {
          const remoteFile = getRemoteLocation({
            server,
            file,
          })
          const setup = () => {}
          const teardown = collectCoverage
            ? (value) => {
                if ("__coverage__" in window === false) {
                  throw new Error(`missing __coverage__ after ${file} execution`)
                }

                return {
                  value,
                  coverage: window.__coverage__,
                }
              }
            : (value) => {
                return { value }
              }

          return driver
            .get(indexRequestHandler.url)
            .then(() =>
              runFile({
                driver,
                file: remoteFile,
                setup,
                teardown,
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
}
