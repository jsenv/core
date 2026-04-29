import { createContext } from "preact";

// Context provided by Select to pass its composite uiAction down to children.
// List reads this context to get a uiAction when none is provided as a prop.
export const SelectUIActionContext = createContext(null);
