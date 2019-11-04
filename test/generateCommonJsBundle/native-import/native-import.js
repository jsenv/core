import { readFile } from "fs"

export default typeof readFile === "function" ? 42 : 40
