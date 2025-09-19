import { processData } from "./helper.js";

// Should trigger error - 'age' is not a valid parameter for processData
processData({ id: 1, name: "John", age: 30 });

// Should not trigger error - all params are valid
processData({ id: 2, name: "Jane" });
