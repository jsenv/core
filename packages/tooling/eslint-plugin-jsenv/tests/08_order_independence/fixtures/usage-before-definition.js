// Test that function calls before function definition are handled correctly

// Call function before it's defined
doSomething({ name: "test", extra: "value" }); // extra should be flagged

// Define the function after the call
function doSomething({ name }) {
  console.log(name);
}
