// this is how it could work with await

import { createCancel } from "./cancel.js"

const { cancel, cancellable } = createCancel()

const execute = async (cancellable) => {
  await cancellable(Promise.resolve())
}

execute(cancellable).then(() => {
  // will never happen because cancel( claled below)
})
cancel()
