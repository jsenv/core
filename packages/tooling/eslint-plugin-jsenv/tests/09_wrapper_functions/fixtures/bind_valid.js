// Test Function.prototype.bind wrapper - valid case
function myFunction({ name, age }) {
  console.log(`${name} is ${age} years old`);
}

const boundFunction = myFunction.bind(null);

// Valid usage - all props are used by the original function
boundFunction({ name: "Alice", age: 30 });
