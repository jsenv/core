export function createChain({ initial }) {
  return {
    transform(options) {
      console.log("Transforming with:", options);
      return this;
    },
    finalize() {
      console.log("Finalizing chain with initial:", initial);
      return { result: initial, transformed: true };
    },
  };
}
