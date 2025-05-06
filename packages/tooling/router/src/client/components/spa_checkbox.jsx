import { SPAForm } from "./spa_form.jsx";
import {
  useRef,
  // useLayoutEffect
} from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useActionStatus } from "../action/action_hooks.js";
import { RectangleLoading } from "./rectangle_loading.jsx";
import "./spa_checkbox.css" with { type: "css" };

export const SPACheckbox = ({ action, method = "PUT", ...rest }) => {
  return (
    <SPAForm action={action} method={method}>
      <SPACheckboxInput action={action} {...rest} />
    </SPAForm>
  );
};

const SPACheckboxInput = ({ action, label, checked, ...rest }) => {
  const { pending, aborted } = useActionStatus(action);
  console.log(`action ${action.params.columnName}`, { pending, aborted });

  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    checked,
    action.params.columnName,
  );
  const inputRef = useRef(null);

  // useLayoutEffect(() => {
  //   if (pending) {
  //     // show the loading stuff, ensure we match checkbox size and color somehow
  //   }
  // }, [pending, aborted]);

  const input = (
    <div style="display:inline-flex;position: relative; ">
      {pending && (
        <div style="position: absolute; inset: 0">
          <RectangleLoading />
        </div>
      )}
      <input
        ref={inputRef}
        style="position: relative;"
        className="spa_checkbox"
        type="checkbox"
        name="value"
        onChange={(e) => {
          setOptimisticUIState(e.target.checked);
          const form = e.target.form;
          form.requestSubmit();
        }}
        {...rest}
        checked={optimisticUIState}
        disabled={pending}
      />
    </div>
  );

  if (label) {
    return (
      <label>
        {label}
        {input}
      </label>
    );
  }
  return input;
};
