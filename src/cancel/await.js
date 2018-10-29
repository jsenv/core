// this is how it could work with await

import { createCancel } from "./cancel.js"

const execute = async (cancellation) => {
  await cancellation.wrap(() => Promise.resolve())
}

const { cancel, cancellation } = createCancel()

execute(cancellation).then(() => {
  // will never happen because cancel (called below)
})
cancel()
