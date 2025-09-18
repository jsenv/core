// Test Function.prototype.bind wrapper - invalid case
function myFunction({ name }) {
  console.log(`Hello ${name}`);
}

const boundFunction = myFunction.bind(null);

// Invalid usage - extra prop should be detected
boundFunction({ name: "Alice", extra: "unused" });
