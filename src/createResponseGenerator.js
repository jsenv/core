// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js

export const createResponseGenerator = ({ services = [] }) => {
	const generateResponse = (...args) => {
		let serviceReturnValue
		services.find((service) => {
			serviceReturnValue = service(...args)
			return Boolean(serviceReturnValue)
		})

		if (serviceReturnValue) {
			return serviceReturnValue
		}
		return { status: 501, reason: "no implemented" }
	}

	return generateResponse
}
