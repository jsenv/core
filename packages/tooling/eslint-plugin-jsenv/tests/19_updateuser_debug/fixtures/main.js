import { updateUser } from "./user-service.js";

updateUser({ id: 1, name: "Jane", invalidField: true });
