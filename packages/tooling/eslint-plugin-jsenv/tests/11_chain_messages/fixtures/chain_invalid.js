// Test case: Chain with available parameters shown
function step1({ id, ...rest }) {
  return step2({ ...rest });
}
function step2({ name, email, config }) {
  console.log(name, email, config);
}
step1({ id: 1, name: "John", email: "john@test.com", unknown: "param" }); // Should show available params
