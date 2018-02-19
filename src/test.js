process.on("SIGINT", () => {
	console.log("yo")
})
process.on("uncaughtException", () => {
	console.log("hey")
})

throw "here"
