import { passed, createAction, any } from "@dmail/action"
import { createSignal } from "@dmail/signal"

const createAddExceptionHandler = ({ install }) => {
	const exceptionSignal = createSignal({
		installer: ({ getListeners, removeAllWhileCalling }) => {
			let currentException
			let recoverCurrentException
			let crashCurrentException

			const recoverWhen = (match) => {
				if (currentException && match(currentException)) {
					recoverCurrentException()
				}
			}

			const attemptToRecover = () => {
				const listeners = getListeners()

				const attemptListener = (index) => {
					if (index >= listeners.length) {
						return passed(false)
					}

					const manualAction = createAction()

					recoverCurrentException = () => manualAction.pass(true)
					crashCurrentException = () => manualAction.pass(false)

					return any([manualAction, passed(listeners[index].fn(currentException))]).then(
						(recovered) => {
							if (recovered === false) {
								return attemptListener(index + 1)
							}
							return false
						},
					)
				}

				return attemptListener(0)
			}

			const triggerException = ({ value, origin }) => {
				if (currentException) {
					console.error(`${value} error occured while handling ${currentException}`)
					crashCurrentException()
					return
				}
				currentException = { value, origin }
				attemptToRecover().then((recovered) => {
					if (recovered) {
						currentException = null
						return
					}

					// removeAllWhileCalling prevent catching of the next throw
					// else the following would create an infinite loop
					// process.on('uncaughtException', function() {
					//     setTimeout(function() {
					//         throw 'yo';
					//     });
					// });
					removeAllWhileCalling(() => {
						throw currentException.value // this mess up the stack trace :'(
					})
				})
			}

			return install({
				triggerException,
				recoverWhen,
			})
		},
	})

	return exceptionSignal.listen
}

export const addNodeExceptionHandler = createAddExceptionHandler({
	install: ({ triggerException, recoverWhen }) => {
		const onError = (error) => {
			triggerException({
				value: error,
			})
		}

		const onUnhandledRejection = (value, promise) => {
			triggerException({
				value,
				origin: promise,
			})
		}

		const onRejectionHandled = (promise) => {
			recoverWhen(({ origin }) => origin === promise)
		}

		process.on("unhandledRejection", onUnhandledRejection)
		process.on("rejectionHandled", onRejectionHandled)
		process.on("uncaughtException", onError)

		return () => {
			process.removeListener("unhandledRejection", onUnhandledRejection)
			process.removeListener("rejectionHandled", onRejectionHandled)
			process.removeListener("uncaughtException", onError)
		}
	},
})
