import { createSignal } from "@dmail/signal"
import readline from "readline"

export const createListenBeforeExit = ({ install, exit }) => {
	const beforeExitSignal = createSignal({
		listened: ({ emit, clear }) => {
			const triggerBeforeExit = () => {
				const executions = emit()
				const listenerPromises = executions.map(({ value }) => Promise.resolve(value))

				return Promise.race(listenerPromises).then(() => {
					// remove all listeners
					// so that any function returned by install() (the unlistened function)
					// gets called
					clear()
					exit()
				})
			}

			return install(triggerBeforeExit)
		},
	})

	return beforeExitSignal.listen
}

const isWindows = () => process.platform === "win32"

export const listenNodeBeforeExit = createListenBeforeExit({
	install: (callback) => {
		if (isWindows()) {
			// http://stackoverflow.com/questions/10021373/what-is-the-windows-equivalent-of-process-onsigint-in-node-js
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			})

			const forceEmit = () => {
				process.emit("SIGINT")
			}

			rl.on("SIGINT", forceEmit)
			process.on("SIGINT", callback)

			return () => {
				rl.removeListener("SIGINT", forceEmit)
				process.removeListener("SIGINT", callback)
			}
		}

		process.on("SIGINT", callback)

		return () => {
			process.removeListener("SIGINT", callback)
		}
	},
	exit: () => {
		process.exit()
	},
})

export const listenBrowserBeforeExit = createListenBeforeExit({
	install: (callback) => {
		const { onbeforeunload } = window
		window.onbeforeunload = callback

		return () => {
			window.onbeforeunload = onbeforeunload
		}
	},
	exit: () => {
		// in the browser this may not be called
		// because you cannot prevent user from leaving your page
	},
})

// const exit = env.platformPolymorph({
//       browser() {
//
//       },
//       node() {
//           process.exit();
//       }
//   });
//   const install = env.platformPolymorph({
//
//       node(callback) {
//
//       }
//   });
//   const listeners = [];
//   let uninstaller = null;
//   let installed = false;

// })());
