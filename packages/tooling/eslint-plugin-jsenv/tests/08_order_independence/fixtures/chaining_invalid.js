// Test function chaining with order independence - invalid case

// Call before definition with truly unused param
processData({ name: "test", age: 25, unused: "value" });

function processData({ name, ...rest }) {
  return handleRest({ ...rest });
}

function handleRest({ age }) {
  return age;
}
// 'unused' is not handled in the chain
