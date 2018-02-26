import { createSignal } from "@dmail/signal"
import { passed, all } from "@dmail/action"

export const createListenBeforeExit = ({ install, exit }) => {
	const beforeExitSignal = createSignal({
		installer: ({ emit, removeAllWhileCalling }) => {
			const triggerBeforeExit = () => {
				const executions = emit()
				const listenerActions = executions.map(({ value }) => passed(value))

				return all(listenerActions).then(() => {
					removeAllWhileCalling(exit)
				})
			}

			return install(triggerBeforeExit)
		},
	})

	return beforeExitSignal.listen
}

export const listenNodeBeforeExit = createListenBeforeExit({
	install: (callback) => {
		process.on("SIGINT", callback)
		process.on("beforeExit", callback)

		return () => {
			process.removeListener("SIGINT", callback)
			process.removeListener("beforeExit", callback)
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
