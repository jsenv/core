export default Object.setPrototypeOf ||
  ((o, p) => {
    // eslint-disable-next-line no-proto
    o.__proto__ = p
    return o
  })
