import { allowCustomElementsRedefine } from "@jsenv/custom-elements-redefine";

if (import.meta.hot) {
  allowCustomElementsRedefine();
}
