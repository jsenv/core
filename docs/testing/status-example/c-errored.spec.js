const error = new Error("here")
error.stack = "<stack hidden>"
throw error
