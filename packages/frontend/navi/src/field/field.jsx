import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { extractMessageAndRemainingProps } from "./validation/constraint_message.js";

const css = /* css */ `
  @layer navi {
    [data-navi-field] {
      --field-spacing: var(--navi-xs);

      > * + .navi_label {
        padding-left: var(--field-spacing);
      }
      > .navi_label:first-child {
        padding-right: var(--field-spacing);
      }
      &[data-vertical] > .navi_label:first-child {
        padding-bottom: var(--field-spacing);
      }

      .navi_checkbox {
        --margin: 0;
      }
      .navi_radio {
        --margin: 0;
      }
      &[data-interactive] {
        .navi_label {
          cursor: pointer;
          /* When label is interactive ability to select text oftens conflicts with other click interactions */
          user-select: none;
        }
      }
      &[data-readonly],
      &[data-disabled] {
        .navi_label {
          color: rgba(0, 0, 0, 0.5);
          cursor: default;
        }
      }
    }
  }
`;

export const FieldContext = createContext(null);
export const useFieldId = () => {
  const ctx = useContext(FieldContext);
  return ctx ? ctx.fieldId : undefined;
};

export const reportReadOnlyToField = (value) => {
  const ctx = useContext(FieldContext);
  useLayoutEffect(() => {
    ctx?.setReadOnly(value);
  });
};

export const reportDisabledToField = (value) => {
  const ctx = useContext(FieldContext);
  useLayoutEffect(() => {
    ctx?.setDisabled(value);
  });
};

export const reportInteractiveToField = (value) => {
  const ctx = useContext(FieldContext);
  useLayoutEffect(() => {
    ctx?.setInteractive(value);
  });
};

/**
 * Field — a semantic wrapper that connects a label to a form control.
 *
 * It generates a stable `fieldId` (or accepts an explicit `id`) that is
 * automatically forwarded to the `Label` inside the field as `htmlFor` and to
 * any interactive control (Picker, Input, …) as its `id`, so clicking the
 * label focuses the control without requiring manual wiring.
 *
 * It also tracks the readOnly / disabled / interactive state reported by its
 * child control and reflects it on the `Label` (dimmed color, cursor change).
 *
 * Props:
 *   id        — optional explicit id used as the field id instead of the auto-generated one
 *   vertical  — shorthand for flex="y" + alignX="start"
 *   children  — any JSX; should contain a `Label` and a form control
 *   ...rest   — forwarded to the wrapping `<div>` (className, style, flex, spacing, …)
 *
 * @example
 * <Field vertical spacing="s">
 *   <Label>Date de début</Label>
 *   <Input name="start_date" required />
 * </Field>
 */
export const Field = (props) => {
  import.meta.css = css;
  const refDefault = useRef();
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  const fieldId = `field_${idDefault}`;
  props.id = props.id || fieldId;
  const { vertical } = props;
  const fieldBehaviorProps = useFieldBehaviorProps(props);

  return (
    <Box
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      data-vertical={vertical ? "" : undefined}
      styleCSSVars={FieldCSSVars}
      // baseClassName="navi_field"
      {...fieldBehaviorProps}
    />
  );
};
const FieldCSSVars = {
  spacing: "--field-spacing",
};
const FieldPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

export const useFieldBehaviorProps = (props) => {
  import.meta.css = css;
  const { id, readOnly, disabled, ...rest } = props;

  // Collect constraint message props so child fields can inherit them via context.
  const [fieldMessageProps, remainingProps] =
    extractMessageAndRemainingProps(rest);
  const fieldMessagePropsRef = useRef(fieldMessageProps);
  fieldMessagePropsRef.current = fieldMessageProps;

  const [readOnlyFromChild, setReadOnlyFromChild] = useState(false);
  const [disabledByChild, setDisabledByChild] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const readOnlyEffective = readOnly || readOnlyFromChild;
  const disabledEffective = disabled || disabledByChild;

  const contextValue = useMemo(
    () => ({
      fieldId: id,
      interactive,
      readOnly: readOnlyEffective,
      disabled: disabledEffective,
      setReadOnly: setReadOnlyFromChild,
      setDisabled: setDisabledByChild,
      setInteractive,
      messagePropsRef: fieldMessagePropsRef,
    }),
    [id, interactive, readOnlyEffective, disabledEffective],
  );

  let childrenWithContext;
  if (props.children === undefined) {
  } else {
    childrenWithContext = (
      <FieldContext.Provider value={contextValue}>
        {props.children}
      </FieldContext.Provider>
    );
  }

  return {
    "data-navi-field": "",
    "data-interactive": interactive ? "" : undefined,
    ...remainingProps,
    "children": childrenWithContext,
    "pseudoClasses": FieldPseudoClasses,
    "basePseudoState": {
      ":read-only": readOnlyEffective,
      ":disabled": disabledEffective,
      ...remainingProps.basePseudoState,
    },
  };
};

export const Label = (props) => {
  const { children, htmlFor, ...rest } = props;
  const ctx = useContext(FieldContext);
  const fieldId = ctx?.fieldId;

  return (
    <Box
      as="label"
      htmlFor={htmlFor || fieldId}
      baseClassName="navi_label"
      pseudoClasses={LabelPseudoClasses}
      {...rest}
    >
      {children}
    </Box>
  );
};
const LabelPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
