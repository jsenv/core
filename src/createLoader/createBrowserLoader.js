import { createLoader } from "./createLoader.js"

export const createBrowserLoader = ({ base } = {}) => {
	return createLoader({ base })
}
