import { statSync } from 'node:fs'

const url = new URL('./#.txt', import.meta.url)
const stat = statSync(url)
console.log(stat.isDirectory())
