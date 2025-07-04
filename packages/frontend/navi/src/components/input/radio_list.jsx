import { dispatchRequestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useNavState } from "../use_nav_state.js";

import.meta.css = /*css*/ `
.radio_list {
    display: flex;
    flex-direction: column;
}`;

export const RadioList = forwardRef((props, ref) => {
  const {
    id,
    name,
    action,
    options,
    actionPendingEffect = "loading",
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  let checkedValueAtStart;
  for (const option of options) {
    if (option.checked) {
      checkedValueAtStart = option.value;
    }
  }
  if (checkedValueAtStart === undefined && navStateValue !== undefined) {
    checkedValueAtStart = navStateValue;
  }

  const [effectiveAction, getCheckedValue, setCheckedValue] = useAction(
    action,
    {
      name,
      value: checkedValueAtStart,
    },
  );
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef();

  const checkedValueFromSignal = getCheckedValue();
  const checkedValue =
    error || aborted ? checkedValueAtStart : checkedValueFromSignal;

  return (
    <div
      className="radio_list"
      ref={innerRef}
      {...rest} // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (!actionEvent.target.form) {
          const requester = actionEvent.detail.requester;
          actionRequesterRef.current = requester;
          executeAction(effectiveAction, { requester });
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={() => {
        setNavStateValue(undefined);
        onActionEnd?.();
      }}
    >
      {options.map((option) => {
        const { value, disabled } = option;
        const checked = checkedValue === value;
        const radioRef = useRef(null);

        let radio = (
          <input
            ref={radioRef}
            type="radio"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled || pending}
            onChange={(event) => {
              const radio = event.target;
              const radioIsChecked = radio.checked;
              if (radioIsChecked) {
                setCheckedValue(value);
              } else {
                // if nothing else is checked we should reset
              }
              if (!radio.form) {
                actionRequesterRef.current = radio;
                const radioListContainer = innerRef.current;
                dispatchRequestAction(radioListContainer, event);
              }
            }}
          />
        );

        if (actionPendingEffect === "loading") {
          radio = (
            <LoaderBackground
              pending={
                pending &&
                actionRequesterRef.current &&
                actionRequesterRef.current === radioRef.current
              }
            >
              {radio}
            </LoaderBackground>
          );
        }

        return (
          <label
            key={value}
            data-disabled={disabled || pending ? "" : undefined}
          >
            {radio}
            {option.renderLabel(option)}
          </label>
        );
      })}
    </div>
  );
});
