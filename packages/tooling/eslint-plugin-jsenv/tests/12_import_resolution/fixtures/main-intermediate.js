import { processData, validateUser } from "./intermediate.js";

// Should trigger error - 'age' is not valid for processData (imported through intermediate.js)
processData({ id: 1, name: "John", age: 30 });

// Should trigger error - 'isActive' is not valid for validateUser
validateUser({ username: "john", email: "john@test.com", isActive: true });

// Should not trigger errors - all params are valid
processData({ id: 2, name: "Jane" });
validateUser({ username: "jane", email: "jane@test.com" });
