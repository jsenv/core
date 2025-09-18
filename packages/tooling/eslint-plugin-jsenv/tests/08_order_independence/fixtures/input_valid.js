// Test that function calls before function definition work correctly

// Call function before it's defined - all parameters valid
doSomething({ name: "test" });

// Define the function after the call
function doSomething({ name }) {
  console.log(name);
}
