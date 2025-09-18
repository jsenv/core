// Test with function hoisting - valid scenario
hoistedCall({ name: "test" }); // Should work without warnings

function hoistedCall({ name }) {
  console.log(name);
}
