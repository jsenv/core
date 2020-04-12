import { fetchUrl } from "../../fetchUrl.js"

export const fetchSource = ({ url, executionId }) => {
  return fetchUrl(url, {
    ignoreHttpsError: true,
    // il faut que je passe ceci a false
    // et en fonction je lirais la réponse différement
    // simplified: false,
    headers: {
      ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
    },
  })
}
