const createChildError = (properties) => {
  const childError = new Error(properties.message)
  Object.assign(childError, properties)
  // childError.name = "CHILD_ERROR"
  return childError
}

export const createScriptClosedError = (code) => {
  if (code === 12) {
    return createChildError({
      message: `child exited with 12: forked child wanted to use a non available port for debug`,
    })
  }
  return createChildError({ message: `child exited with ${code}` })
}

export const createScriptClosedWithFailureCodeError = (code) => {
  if (code === 12) {
    return createChildError({
      message: `child exited with 12: forked child wanted to use a non available port for debug`,
    })
  }
  return createChildError({
    message: `child exited with ${code}`,
  })
}
