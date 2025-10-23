// Test case: Simple direct function call with completely unknown parameter
function greet({ name }) {
  return `Hello ${name}`;
}
greet({ xyz: "John" }); // 'xyz' is completely unknown and different from expected params
