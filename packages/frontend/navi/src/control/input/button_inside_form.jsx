import { useContext } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { FormContext } from "../form_context.js";

/**
 * Notes on Button uiAction and action behavior regarding their context (form, radio list, picker):
 *
 * - A button ui action receives closest ui state in param (form, radiolist, ...)
 * - If button is type="submit" it will try to execute closest form action
 *   but ideally you should prefer the syntax <Button uiAction="submit"> as it works in other context too (picker)
 *   and try to execute closest action on form/radiolist etc and uiAction on picker
 *   (This way you can copy paste <Button uiAction="submit"> inside form or inside picker and it works)
 * - A button with an action should not use type="submit" or uiAction="submit" as it would execute both closest action and his own
 */

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
      command="--navi-send"
      {...props}
    />
  );
};
