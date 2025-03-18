import { totalmem } from "node:os";

export const getAvailableMemory = () => totalmem();
