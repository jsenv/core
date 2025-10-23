// Test function chaining with order independence - valid case

// Call before definition with chaining
firstFunction({ a: 1, b: 2 }); // b should be valid via chaining

function firstFunction({ a, ...rest }) {
  return secondFunction({ ...rest });
}

function secondFunction({ b }) {
  return b;
}
