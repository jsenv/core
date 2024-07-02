export const defineObjectPropertyLazyGetter = (object, property, getter) => {
  let computing = false;
  Object.defineProperty(object, property, {
    configurable: true,
    enumerable: true,
    get() {
      if (computing) {
        throw new Error(`cannot get "${property}" while computing`);
      }
      computing = true;
      const value = getter();
      Object.defineProperty(object, property, {
        configurable: true,
        enumerable: true,
        value,
      });
      return value;
    },
  });
};

// export const lazy = (value, compute) => {
//   if (value instanceof Map) {
//     // https://stackoverflow.com/a/57958494/24573072
//     let computed = false;
//     const proxy = new Proxy(value, {
//       has(target, prop, receiver) {
//         if (!computed) {
//           compute();
//           computed = true;
//           compute = null;
//         }
//         let value = Reflect.has(target, prop, receiver);
//         return typeof value === "function" ? value.bind(target) : value;
//       },
//       get(target, prop, receiver) {
//         if (!computed) {
//           compute();
//           computed = true;
//           compute = null;
//         }
//         let value = Reflect.get(target, prop, receiver);
//         return typeof value === "function" ? value.bind(target) : value;
//       },
//     });
//     return proxy;
//   }
//   return value;
// };

// const mergeGenerators = (firstGenerator, secondGenerator) => {
//   return function* () {
//     if (firstGenerator) {
//       yield* firstGenerator();
//     }
//     yield* secondGenerator();
//   };
// };
