// Test case: Valid usage - all parameters are recognized
function process({ id, ...rest }) {
  return handle({ ...rest });
}
function handle({ name, email }) {
  console.log(name, email);
}
process({ id: 1, name: "John", email: "john@test.com" }); // Should be valid
