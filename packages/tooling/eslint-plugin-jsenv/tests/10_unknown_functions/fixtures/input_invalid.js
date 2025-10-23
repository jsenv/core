// Test mixed known and unknown functions

// Known function - should be analyzed
function knownFunction({ name }) {
  console.log(name);
}

// Unknown function calls - should be ignored
window.unknownGlobal({ a: 1, b: 2, c: 3 });
external.method({ x: true, y: false });

// Known function call - should detect extra param
knownFunction({ name: "test", extra: "should be flagged" });
