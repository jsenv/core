import { release } from "node:os";

export const getOsVersion = () => release();
