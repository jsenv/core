// https://github.com/guybedford/systemjs-istanbul/blob/master/index.js

import remapIstanbul from "remap-istanbul/lib/remap.js"

export const getCoverage = ({ globalName }) => {
	return global[globalName]
}

export const remapCoverage = (coverage) => {
	return remapIstanbul(coverage)
}
