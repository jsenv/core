import { passed, createAction, any } from "@dmail/action"

const createAddExceptionHandler = ({ install }) => {
	let currentException
	let recoverCurrentException
	let crashCurrentException

	const handlers = []
	const attemptToRecover = () => {
		const attemptHandler = (index) => {
			if (index >= handlers.length) {
				return passed(false)
			}

			const manualAction = createAction()

			recoverCurrentException = () => manualAction.pass(true)
			crashCurrentException = () => manualAction.pass(false)

			return any(manualAction, passed(handlers[index](currentException))).then((recovered) => {
				if (recovered === false) {
					return attemptHandler(index + 1)
				}
				return false
			})
		}

		return attemptHandler(0)
	}

	const recoverWhen = (match) => {
		if (currentException && match(currentException)) {
			recoverCurrentException()
		}
	}

	let uninstall
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
			// uninstall to prevent catching of the next throw
			// else the following owuld create an infinite loop
			// process.on('uncaughtException', function() {
			//     setTimeout(function() {
			//         throw 'yo';
			//     });
			// });

			uninstall()
			throw currentException.value // this mess up the stack trace :'(

			// reinstall in case something external and crazy is preventing error from
			// terminating the process
			// in a browser environment you don't kill the browser so it would happen more often
			// eslint-disable-next-line no-unreachable
			uninstall = install({
				triggerException,
				recoverWhen,
			})
		})
	}

	uninstall = install({
		triggerException,
		recoverWhen,
	})

	return (handler) => {
		handlers.push(handler)
	}
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
