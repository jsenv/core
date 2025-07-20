import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { LoaderBackground } from "../loader/loader_background.jsx";

import.meta.css = /* css */ `
  .navi_select[data-readonly] {
    pointer-events: none;
  }
`;

export const Select = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: SelectControlled,
  });
});

const SelectControlled = forwardRef((props, ref) => {
  const { name, value, loading, disabled, readOnly, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const selectElement = (
    <select
      className="navi_select"
      ref={innerRef}
      data-field=""
      data-readonly={readOnly && !disabled ? "" : undefined}
      onKeyDown={(e) => {
        if (readOnly) {
          e.preventDefault();
        }
      }}
      {...rest}
    >
      {children.map((child) => {
        const {
          label,
          readOnly: childReadOnly,
          disabled: childDisabled,
          loading: childLoading,
          value: childValue,
          ...childRest
        } = child;

        return (
          <option
            key={childValue}
            name={name}
            value={childValue}
            selected={childValue === value}
            readOnly={readOnly || childReadOnly}
            disabled={disabled || childDisabled}
            loading={loading || childLoading}
            {...childRest}
          >
            {label}
          </option>
        );
      })}
    </select>
  );

  return (
    <LoaderBackground
      loading={loading}
      color="light-dark(#355fcc, #3b82f6)"
      inset={-1}
    >
      {selectElement}
    </LoaderBackground>
  );
});
