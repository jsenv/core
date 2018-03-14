// https://github.com/ModuleLoader/browser-es-module-loader

import { createLoader } from "../createLoader.js"

export const createBrowserLoader = ({ base } = {}) => {
	return createLoader({ base })
}
