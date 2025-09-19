import { complexFunction } from "./complex-signatures.js";

complexFunction({
  required: "value",
  config: { nested: true },
  list: [1, 2, 3],
  unknownProp: "should error",
});
