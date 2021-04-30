export const processOptionsFromExecArgv = (execArgv) => {
  const processOptions = {}

  let i = 0
  while (i < execArgv.length) {
    const execArg = execArgv[i]
    const option = processOptionFromExecArg(execArg)
    processOptions[option.name] = option.value
    i++
  }

  return processOptions
}

const processOptionFromExecArg = (execArg) => {
  const equalCharIndex = execArg.indexOf("=")
  if (equalCharIndex === -1) {
    return {
      name: execArg,
      value: "",
    }
  }

  const name = execArg.slice(0, equalCharIndex)
  const value = execArg.slice(equalCharIndex + 1)
  return {
    name,
    value,
  }
}

export const execArgvFromProcessOptions = (processOptions) => {
  return Object.keys(processOptions).map((processOptionName) => {
    const processOptionValue = processOptions[processOptionName]
    if (processOptionValue === "") {
      return processOptionName
    }
    return `${processOptionName}=${processOptionValue}`
  })
}
