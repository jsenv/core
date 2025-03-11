// eslint-disable-next-line no-unused-vars
function logMethod(target, key, descriptor) {
  const originalMethod = descriptor.value; // Save the original method

  // Redefine the method with custom behavior
  descriptor.value = function (...args) {
    console.log(`Before ${key} is called`);
    const result = originalMethod.apply(this, args);
    console.log(`After ${key} is called`);
    return result;
  };

  return descriptor;
}

class Example {
  // @logMethod
  greet() {
    console.log("Hello, world!");
  }
}

const example = new Example();
example.greet();
