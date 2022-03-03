export default (self) => {
  // eslint-disable-next-line no-void
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called")
  }
  return self
}
