// Invalid: Rest params propagated but unused properties should error
function initializeApp({ name, ...config }) {
  console.log(`Starting ${name}`);
  return setupCore({ ...config });
}

function setupCore({ version }) {
  console.log(`Version: ${version}`);
}

// 'debug' and 'timeout' are passed but never used in the chain
initializeApp({ name: "MyApp", version: "1.0", debug: true, timeout: 5000 });

// Invalid: Rest propagated to function that doesn't accept the properties
function createUser({ id, ...userInfo }) {
  return saveUser({ id, ...userInfo });
}

function saveUser({ id, name }) {
  console.log(`Saving user ${id}: ${name}`);
}

// 'email' and 'age' are passed but not accepted by saveUser
createUser({ id: 1, name: "John", email: "john@example.com", age: 30 });

// Invalid: Complex chain where some properties are lost
function processRequest({ method, ...requestData }) {
  return validateRequest({ method, ...requestData });
}

function validateRequest({ method, ...validationData }) {
  return handleRequest({ method, ...validationData });
}

function handleRequest({ method, body }) {
  console.log(`Handling ${method} with body:`, body);
}

// 'headers' and 'timeout' are passed through the chain but never used
processRequest({
  method: "POST",
  body: { data: "test" },
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});
