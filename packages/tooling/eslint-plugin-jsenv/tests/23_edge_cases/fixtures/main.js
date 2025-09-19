import { createChain } from "./chain-utils.js";
import { createValidator } from "./validator-factory.js";

const result = createChain({ initial: "data", invalidParam: true });
const validator = createValidator({ strict: true, unknownOption: false });
