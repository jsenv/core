export const createExecuteFile = () => {
  return (file) => {
    return import(file)
  }
}
