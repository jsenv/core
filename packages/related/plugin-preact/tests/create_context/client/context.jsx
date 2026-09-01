import { createContext } from "preact";

export const EmptyContext = createContext();
export const ValueContext = createContext({ value: 42 });
