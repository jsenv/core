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
			location: `${path.resolve(__dirname, "../../")}`,
		}),
		startClient(),
	]).then(([, compileServer, client]) => {
		return fromPromise(
			client.page.goto(`${compileServer.url}/src/__test__/index.html`).then(() => {
				return client.page.evaluate(() => {
					System.import(filename)
				})
			}),
		).then((value) => {
			return all([compileServer.close(), client.browser.close()]).then(() => value)
		})
	})
}

test(() => testInBrowser("src/__test/file.test.js"))
