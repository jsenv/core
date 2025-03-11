export default Object.setPrototypeOf
  ? Object.setPrototypeOf.bind()
  : (o, p) => {
      // eslint-disable-next-line no-proto
      o.__proto__ = p;
      return o;
    };
