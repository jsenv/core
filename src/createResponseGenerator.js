// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js

import { createAction, passed } from "@dmail/action"

export const createResponseGenerator = ({ services = [] }) => {
	const generateResponse = (...args) => {
		const action = createAction()

		const visit = (index) => {
			if (index >= services.length) {
				return action.pass()
			}

			const service = services[index]
			passed(service(...args)).then(
				(value) => {
					if (value) {
						action.pass(value)
					} else {
						visit(index + 1)
					}
				},
				(value) => {
					if (value) {
						action.fail(value)
					} else {
						visit(index + 1)
					}
				},
			)
		}

		visit(0)

		return action.then(
			(value) => {
				if (value) {
					return value
				}
				return { status: 501, reason: "no implemented" }
			},
			(value) => {
				if (value) {
					return value
				}
				return { status: 501, reason: "no implemented" }
			},
		)
	}

	return generateResponse
}
