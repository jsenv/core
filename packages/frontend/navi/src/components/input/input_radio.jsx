import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import "../checked_programmatic_change.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";

export const InputRadio = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleInputRadio, ActionInputRadio);
});

const CUSTOM_RADIO_COLORS = {
  borders: {
    default: "#6b7280",
    hover: "#9ca3af",
    disabled: "rgba(118, 118, 118, 0.3)",
    checked: "#3b82f6",
    checkedAndHover: "#1a56db",
    disabledAndChecked: "#D3D3D3",
  },
  outline: {
    default: "light-dark(#1d4ed8, #3b82f6)",
  },
  background: {
    default: "white",
    disabled: "light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3))",
  },
  checkmark: {
    default: "#3b82f6",
    hover: "#1d4ed8",
    disabled: "#D3D3D3",
  },
};

import.meta.css = /*css*/ `
.custom_radio_wrapper {
  display: inline-flex;
  box-sizing: content-box;
}

.custom_radio_wrapper input[type="radio"] {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.custom_radio {
  width: 13px;
  height: 13px;
  border: 1px solid ${CUSTOM_RADIO_COLORS.borders.default};
  border-radius: 50%; /* ✅ Rond comme Chrome */
  background: ${CUSTOM_RADIO_COLORS.background.default};
  transition: all 0.15s ease;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 5px;
  margin-top: 3px;
  margin-right: 3px;
}

.custom_radio svg {
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(0.3);
  transition: all 0.15s ease;
  pointer-events: none;
}

.custom_radio svg circle {
  fill: ${CUSTOM_RADIO_COLORS.checkmark.default};
}

/* États hover */
.custom_radio_wrapper:hover .custom_radio {
  border-color: ${CUSTOM_RADIO_COLORS.borders.hover};
}
.custom_radio_wrapper:hover .custom_radio svg circle {
  fill: ${CUSTOM_RADIO_COLORS.checkmark.hover};
}

.custom_radio_wrapper:hover input[type="radio"]:checked + .custom_radio {
  background: ${CUSTOM_RADIO_COLORS.background.checkedAndHover};
  border-color: ${CUSTOM_RADIO_COLORS.borders.checkedAndHover};
}

/* État checked */
.custom_radio_wrapper input[type="radio"]:checked + .custom_radio {
  background: ${CUSTOM_RADIO_COLORS.background.checked};
  border-color: ${CUSTOM_RADIO_COLORS.borders.checked};
}

.custom_radio_wrapper input[type="radio"]:checked + .custom_radio svg {
  opacity: 1;
  transform: scale(1);
}

/* États disabled */
.custom_radio_wrapper input[type="radio"][disabled] + .custom_radio {
  background-color: ${CUSTOM_RADIO_COLORS.background.disabled};
  border-color: ${CUSTOM_RADIO_COLORS.borders.disabled};
}

.custom_radio_wrapper input[type="radio"][disabled]:checked + .custom_radio {
  border-color: ${CUSTOM_RADIO_COLORS.borders.disabledAndChecked};
}

.custom_radio_wrapper input[type="radio"][disabled]:checked + .custom_radio svg circle {
  fill: ${CUSTOM_RADIO_COLORS.checkmark.disabled};
}

/* Focus state avec outline */
.custom_radio_wrapper input[type="radio"]:focus-visible + .custom_radio {
  outline: 2px solid ${CUSTOM_RADIO_COLORS.outline.default};
  outline-offset: 1px;
}
`;

const CustomRadio = ({ children }) => {
  return (
    <div className="custom_radio_wrapper">
      {children}
      <div className="custom_radio">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="4.25" />
        </svg>
      </div>
    </div>
  );
};

const SimpleInputRadio = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    checked,
    disabled,
    loading,
    onChange,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [innerChecked, setInnerChecked] = useState(checked);
  const checkedRef = useRef(checked);
  if (checkedRef.current !== checked) {
    setInnerChecked(checked);
    checkedRef.current = checked;
  }

  const handleChange = (e) => {
    setInnerChecked(e.target.checked);
    onChange?.(e);
  };

  const inputRadio = (
    <input
      ref={innerRef}
      type="radio"
      checked={innerChecked}
      disabled={disabled}
      onChange={handleChange}
      // eslint-disable-next-line react/no-unknown-property
      onprogrammaticchange={handleChange}
      {...rest}
    />
  );
  const inputRadioDisplayed =
    appeareance === "custom" ? (
      <CustomRadio checked={innerChecked} loading={loading}>
        {inputRadio}
      </CustomRadio>
    ) : (
      inputRadio
    );

  const loaderColor =
    disabled && loading
      ? innerChecked
        ? CUSTOM_RADIO_COLORS.borders.checked
        : CUSTOM_RADIO_COLORS.borders.default
      : undefined;
  const inputRadioWithLoader = (
    <LoaderBackground
      loading={loading}
      color={loaderColor}
      targetSelector={appeareance === "custom" ? ".custom_radio" : ""}
      inset={-1}
    >
      {inputRadioDisplayed}
    </LoaderBackground>
  );

  return inputRadioWithLoader;
});

const ActionInputRadio = forwardRef((props, ref) => {
  const {
    id,
    name,
    value = "",
    checked: initialChecked = false,
    action,
    disabled,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  if (import.meta.dev && value === "") {
    console.warn(
      `InputRadio: value is an empty string, this is probably not what you want`,
    );
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart = initialChecked || navStateValue === value;
  const [effectiveAction, getCheckedValue, setCheckedValue] = useAction(
    action,
    {
      name,
      value: checkedAtStart ? value : undefined,
    },
  );
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const { pending, error, aborted } = useActionStatus(effectiveAction);

  const valueChecked = getCheckedValue();
  const checked = error || aborted ? initialChecked : value === valueChecked;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      if (checked) {
        setNavStateValue(value);
      }
      if (checkedAtStart) {
        setCheckedValue(value);
      }
      onCancel?.(e);
    },
    onPrevented: onActionPrevented,
    onAction: (e) => {
      if (action) {
        executeAction(effectiveAction, {
          requester: e.detail.requester,
        });
      }
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: () => {
      setNavStateValue(undefined);
      onActionEnd?.();
    },
  });

  return (
    <SimpleInputRadio
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      data-validation-message-arrow-x="center"
      checked={checked}
      disabled={disabled || pending}
      onChange={(e) => {
        const radioIsChecked = e.target.checked;
        if (radioIsChecked) {
          setNavStateValue(value);
          setCheckedValue(value);
          if (!e.target.form && action) {
            requestAction(e);
          }
        }
        onChange?.(e);
      }}
    />
  );
});
