const e = new Error('here')
const e2 = new Error('message', { cause: e})
throw e2