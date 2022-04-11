import { readFile } from "fs"

export const value = typeof readFile === "function" ? 42 : 40
