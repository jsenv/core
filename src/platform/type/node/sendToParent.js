export const sendToParent = (type, data) => {
  process.send({
    type,
    data,
  })
}
