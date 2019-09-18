import AsyncGenerator from "../AsyncGenerator/AsyncGenerator.js"

export default function(fn) {
  return function() {
    // eslint-disable-next-line prefer-rest-params
    return new AsyncGenerator(fn.apply(this, arguments))
  }
}
