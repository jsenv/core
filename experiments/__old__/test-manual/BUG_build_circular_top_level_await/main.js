import { add } from "./add.js"

const { value } = await import("./file.js")

console.log(value)

export const result = add(value, 2)
