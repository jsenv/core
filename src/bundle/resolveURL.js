import { URL } from "url"

export const resolveURL = (from, to) => {
  return new URL(to, from).href
}
