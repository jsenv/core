export default Object.setPrototypeOf
  ? Object.getPrototypeOf
  : // eslint-disable-next-line no-proto
    (o) => o.__proto__ || Object.getPrototypeOf(o)
