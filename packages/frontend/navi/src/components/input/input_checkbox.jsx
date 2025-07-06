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

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    SimpleInputCheckbox,
    ActionInputCheckbox,
  );
});

const SimpleInputCheckbox = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    value = "on",
    checked,
    disabled,
    loading,
    onChange,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;

  const innerRef = useRef();
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

  const inputCheckbox = (
    <input
      ref={innerRef}
      type="checkbox"
      value={value}
      checked={innerChecked}
      disabled={disabled}
      onChange={handleChange}
      // eslint-disable-next-line react/no-unknown-property
      onprogrammaticchange={handleChange}
      {...rest}
    />
  );

  const inputCheckboxDisplayed =
    appeareance === "custom" ? (
      <CustomCheckbox
        checked={innerChecked}
        disabled={disabled}
        loading={loading}
      >
        {inputCheckbox}
      </CustomCheckbox>
    ) : (
      inputCheckbox
    );

  const loaderColor = loading
    ? innerChecked
      ? CUSTOM_CHECKBOX_COLORS.borders.checked
      : CUSTOM_CHECKBOX_COLORS.borders.default
    : undefined;
  const inputCheckboxWithLoader = (
    <LoaderBackground
      loading={loading}
      // We are disabling inputs while loading so their colors become grayish
      // But they are disabled because we are loading so in that case we want
      // the loader to keep the color the element would have if it was not disabled
      color={loaderColor}
      {...(appeareance === "custom" && {
        targetSelector: ".custom_checkbox",
      })}
    >
      {inputCheckboxDisplayed}
    </LoaderBackground>
  );

  return inputCheckboxWithLoader;
});

const CUSTOM_CHECKBOX_COLORS = {
  borders: {
    default: "#6b7280",
    hover: "#9ca3af",
    disabled: "rgba(118, 118, 118, 0.3)",
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabledAndChecked: "#D3D3D3",
  },
  background: {
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabled: "light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3))",
    disabledAndChecked: "#D3D3D3",
  },
  checkmark: {
    default: "white",
    disabled: "#EEEEEE",
  },
};
import.meta.css = /*css*/ `
.custom_checkbox_wrapper {
  display: inline-flex;
  padding: 3px 3px 3px 4px;
  border-radius: 2px;
  box-sizing: content-box;
}

.custom_checkbox_wrapper input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.custom_checkbox {
  width: 13px;
  height: 13px;
  border: 1px solid ${CUSTOM_CHECKBOX_COLORS.borders.default};
  border-radius: 2px;
  transition: all 0.15s ease;
  box-sizing: border-box;
  display: inline-flex;
}
.custom_checkbox svg {
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.15s ease;
  pointer-events: none;
}
.custom_checkbox svg path {
  stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.default};
}

.custom_checkbox_wrapper:hover .custom_checkbox {
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.hover};
}
.custom_checkbox_wrapper:hover input[type="checkbox"]:checked + .custom_checkbox {
  background: ${CUSTOM_CHECKBOX_COLORS.background.checkedAndHover};
  border-color:${CUSTOM_CHECKBOX_COLORS.borders.checkedAndHover};
}
.custom_checkbox_wrapper input[type="checkbox"]:checked + .custom_checkbox {
  background: ${CUSTOM_CHECKBOX_COLORS.background.checked};
  border-color:${CUSTOM_CHECKBOX_COLORS.borders.checked};
}
.custom_checkbox_wrapper input[type="checkbox"]:checked + .custom_checkbox svg {
  opacity: 1;
  transform: scale(1);
}
.custom_checkbox_wrapper input[type="checkbox"][disabled] + .custom_checkbox {
  background-color: ${CUSTOM_CHECKBOX_COLORS.background.disabled};
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabled};
}
.custom_checkbox_wrapper input[type="checkbox"][disabled]:checked + .custom_checkbox {
   background: ${CUSTOM_CHECKBOX_COLORS.background.disabledAndChecked}; 
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabledAndChecked};
}
.custom_checkbox_wrapper input[type="checkbox"][disabled]:checked .custom_checkbox svg path {
  stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.disabled}; 
}

/* [data-loader-visible] .custom_checkbox[data-loading],
[data-loader-visible] .custom_checkbox[data-loading][data-checked]  {
  transition-property: background, transform, opacity, box-shadow;
  border-color: rgba(0, 0, 0, 0.5);
} */
`;

const CustomCheckbox = ({
  checked = false,
  disabled = false,
  loading = false,
  children,
}) => {
  return (
    <div
      className="custom_checkbox_wrapper"
      data-disabled={disabled ? "" : undefined}
      data-checked={checked ? "" : undefined}
      data-loading={loading ? "" : undefined}
    >
      {children}
      <div className="custom_checkbox">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

const ActionInputCheckbox = forwardRef((props, ref) => {
  const {
    id,
    name,
    checked: initialChecked = false,
    action,
    disabled,
    loading,
    onCancel,
    onInput,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    value = "on",
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : navStateValue;

  const [effectiveAction, getChecked, setChecked] = useAction(action, {
    name,
    value: checkedAtStart ? value : undefined,
  });
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const checkedFromSignal = getChecked();
  const checked = error || aborted ? initialChecked : checkedFromSignal;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      setNavStateValue(undefined);
      setChecked(checkedAtStart);
      onCancel?.(e, reason);
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
    <SimpleInputCheckbox
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      checked={checked}
      disabled={disabled || pending}
      loading={loading || pending}
      data-validation-message-arrow-x="center"
      onChange={(e) => {
        const checkboxIsChecked = e.target.checked;
        if (checkedAtStart) {
          setNavStateValue(checkboxIsChecked ? false : undefined);
        } else {
          setNavStateValue(checkboxIsChecked ? true : undefined);
        }
        setChecked(checkboxIsChecked ? value : undefined);
        onInput?.(e);
        if (action) {
          requestAction(e);
        }
      }}
    />
  );
});
