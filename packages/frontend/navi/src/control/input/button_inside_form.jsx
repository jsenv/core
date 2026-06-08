import { useContext } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { FormContext } from "../form_context.js";

export const ButtonInsideFormResolver = (props) => {
  const Next = useNextResolver();
  const formContext = useContext(FormContext);

  if (formContext) {
    return <ButtonInsideForm {...props} />;
  }
  return <Next {...props} />;
};
const ButtonInsideForm = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      // The default action for a button inside a form is to request form action
      action="send"
      {...props}
    />
  );
};
