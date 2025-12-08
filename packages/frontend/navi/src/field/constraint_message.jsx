import { render } from "preact";
import { useEffect, useId } from "preact/hooks";
import { arraySignal } from "../utils/array_signal.js";

// huuum en gros il faurais gérer une liste de message qu'on veut avoir dans le DOM
// et les portalisé dans ce container
// on pourrait surement juste avoir une liste de custom components
// dans un tableau et render ce coomposant
const [
  constraintComponentArraySignal,
  addConstraintComponent,
  removeConstraintComponent,
] = arraySignal();
const ContraintMessageContainer = () => {
  const constraintComponentArray = constraintComponentArraySignal.value;
  if (constraintComponentArray.length === 0) {
    return null;
  }
  return (
    <div id="navi_constraint_message_container">
      {constraintComponentArray.map((constraintComponent) => {
        return (
          <div key={constraintComponent.id} id={constraintComponent.id}>
            {constraintComponent.jsx}
          </div>
        );
      })}
    </div>
  );
};
render(<ContraintMessageContainer />, document.body);

export const useConstraintMessage = (jsx) => {
  const id = `constraint_message_${useId()}`;

  useEffect(() => {
    const constraintComponent = { jsx, id };
    addConstraintComponent(constraintComponent);
    return () => {
      removeConstraintComponent(constraintComponent);
    };
  }, []);

  return id;
};
