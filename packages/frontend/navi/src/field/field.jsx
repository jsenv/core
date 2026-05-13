import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_field {
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
  const { id, vertical, readOnly, disabled, children, ...rest } = props;
  const idDefault = useId();
  const fieldId = id || `field_${idDefault}`;
  const [readOnlyFromChild, setReadOnlyFromChild] = useState(false);
  const [disabledByChild, setDisabledByChild] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const readOnlyEffective = readOnly || readOnlyFromChild;
  const disabledEffective = disabled || disabledByChild;

  const contextValue = useMemo(
    () => ({
      fieldId,
      interactive,
      readOnly: readOnlyEffective,
      disabled: disabledEffective,
      setReadOnly: setReadOnlyFromChild,
      setDisabled: setDisabledByChild,
      setInteractive,
    }),
    [fieldId, interactive, readOnlyEffective, disabledEffective],
  );

  return (
    <Box
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      spacing="s"
      {...rest}
      data-interactive={interactive ? "" : undefined}
      baseClassName="navi_field"
      pseudoClasses={FieldPseudoClasses}
      basePseudoState={{
        ":read-only": readOnlyEffective,
        ":disabled": disabledEffective,
      }}
    >
      <FieldContext.Provider value={contextValue}>
        {children}
      </FieldContext.Provider>
    </Box>
  );
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

export const Label = (props) => {
  const { children, htmlFor, ...rest } = props;
  const ctx = useContext(FieldContext);
  const fieldId = ctx?.fieldId;

  return (
    <Box
      as="label"
      htmlFor={htmlFor || fieldId}
      baseClassName="navi_label"
      {...rest}
    >
      {children}
    </Box>
  );
};
