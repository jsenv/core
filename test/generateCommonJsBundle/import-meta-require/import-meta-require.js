const { readFile } = import.meta.require("fs")

export default typeof readFile === "function" ? 42 : 40
