export const filter = (generator, callback) => {
  return ({ next, ...rest }) => {
    return generator({
      next: (value) => {
        return callback(value) ? next(value) : undefined
      },
      ...rest,
    })
  }
}
