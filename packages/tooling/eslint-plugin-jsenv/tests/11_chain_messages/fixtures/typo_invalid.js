// Test case: Function call with typo in parameter name
function authenticate({ username, password }) {
  return login(username, password);
}
authenticate({ username: "john", passwd: "secret" }); // 'passwd' should suggest 'password'
