export const getCommandArgument = (argv, name) => {
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]

    if (arg === name) {
      return {
        name,
        index: i,
        value: "",
      }
    }

    if (arg.startsWith(`${name}=`)) {
      return {
        name,
        index: i,
        value: arg.slice(`${name}=`.length),
      }
    }

    i++
  }

  return null
}

export const addOrReplaceCommandArgument = (argv, name, value) => {
  const argSource = value ? `${name}=${value}` : name
  const argvCopy = argv.slice()
  const arg = getCommandArgument(argvCopy, name)
  if (arg) {
    argvCopy[arg.index] = argSource
  } else {
    argvCopy.push(argSource)
  }
  return argvCopy
}

export const removeCommandArgument = (argv, name) => {
  const argvCopy = argv.slice()
  const arg = getCommandArgument(argv, name)
  if (arg) {
    argvCopy.splice(arg.index, 1)
  }

  return argvCopy
}
