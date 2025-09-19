import { createUser, deleteUser, updateUser } from "./user-service.js";

createUser({ name: "John", email: "john@example.com", password: "secret" });
updateUser({ id: 1, name: "Jane", invalidField: true });
deleteUser({ id: 1, force: true });
