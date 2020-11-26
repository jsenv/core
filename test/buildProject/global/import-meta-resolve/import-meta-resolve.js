const relative = import.meta.resolve("./file.js")

const bareA = import.meta.resolve("bareA")

const bareB = import.meta.resolve("bareB")

export default Promise.all([relative, bareA, bareB])
