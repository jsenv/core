import { dispatchRequestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import "../checked_programmatic_change.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

import.meta.css = /*css*/ `
.radio_list {
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 0;
    border: none;
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
      break;
    }
  }
  if (checkedValueAtStart === undefined && navStateValue !== undefined) {
    checkedValueAtStart = navStateValue;
  }
  useOnFormReset(innerRef, () => {
    setNavStateValue(navStateValue);
    setCheckedValue(checkedValueAtStart);
  });

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
    <fieldset
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
        setNavStateValue(undefined); // the action is completed the nav state is no longer needed
        onActionEnd?.();
      }}
    >
      {options.map((option) => {
        const { id, value, disabled, renderLabel } = option;
        const checked = checkedValue === value;
        const radioRef = useRef(null);

        const onCheck = (event) => {
          const radio = event.target;
          setCheckedValue(value);
          if (!radio.form) {
            actionRequesterRef.current = radio;
            const radioListContainer = innerRef.current;
            dispatchRequestAction(radioListContainer, event);
          }
        };
        const onUncheck = (event) => {
          // checking if other radio are unchecked is rather useless
          // in case of browser "change" event as browser always uncheck one in favor of an other
          // the only way to uncheck without having something else checked is to do it programmatically (or via form reset button)
          // so we could theorically skip this check and assume no other radio is checked
          // HOWEVER let's be robust
          const radio = event.target;
          const closestContainer =
            radio.form ||
            radio.closest(".radio_list") ||
            radio.closest("fieldset") ||
            document;
          const radios = closestContainer.querySelectorAll(
            `input[type="radio"][name="${name}"]`,
          );
          let otherRadioChecked;
          for (const radioCandidate of radios) {
            if (radioCandidate === radio) {
              continue;
            }
            if (radioCandidate.checked) {
              otherRadioChecked = true;
              break;
            }
          }
          if (!otherRadioChecked) {
            setCheckedValue(undefined);
            if (!radio.form) {
              actionRequesterRef.current = radio;
              const radioListContainer = innerRef.current;
              dispatchRequestAction(radioListContainer, event);
            }
          }
        };

        let radio = (
          <input
            ref={radioRef}
            type="radio"
            id={id}
            name={name}
            value={value}
            checked={checked}
            disabled={disabled || pending}
            onChange={(event) => {
              const radio = event.target;
              const radioIsChecked = radio.checked;
              if (radioIsChecked) {
                onCheck(event);
              } else {
                onUncheck(event);
              }
            }}
            // eslint-disable-next-line react/no-unknown-property
            onprogrammaticchange={(event) => {
              const radio = event.target;
              const radioIsChecked = radio.checked;
              if (radioIsChecked) {
                onCheck(event);
              } else {
                onUncheck(event);
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
            {renderLabel(option)}
          </label>
        );
      })}
    </fieldset>
  );
});
