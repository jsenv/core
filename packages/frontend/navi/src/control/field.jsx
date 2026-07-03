import { useContext, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { ControlIdContext, MessagePropsRefContext } from "./control_context.js";
import { extractMessageAndRemainingProps } from "./rules/constraint_message.js";

const css = /* css */ `
  @layer navi {
    .navi_label {
      &[data-control-connected] {
        cursor: pointer;
        user-select: none;
      }
      &[data-readonly],
      &[data-disabled] {
        color: rgba(0, 0, 0, 0.5);
        cursor: default;
      }
    }

    [navi-field] {
      --spacing-with-control: var(--navi-xs);

      .navi_checkbox {
        --margin: 0;
      }
      .navi_radio {
        --margin: 0;
      }
    }

    /* Field container: padding on Label extends its interactive zone */
    :not(label)[navi-field] {
      > [navi-control] + .navi_label {
        padding-left: var(--spacing-with-control);
      }
      > .navi_label:first-child {
        padding-right: var(--spacing-with-control);
      }
      &[data-vertical] {
        > .navi_label:first-child {
          padding-right: 0;
          padding-bottom: var(--spacing-with-control);
        }
        > [navi-control] + .navi_label {
          padding-top: var(--spacing-with-control);
          padding-left: 0;
        }
      }
    }
  }
`;

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
 *   flex="y"  — vertical layout; automatically sets alignX="start" and data-vertical
 *   children  — any JSX; should contain a `Label` and a form control
 *   ...rest   — forwarded to the wrapping element (className, style, flex, spacing, …)
 *
 * @example
 * <Field flex spacingWithControl="s">
 *   Date de début
 *   <Input name="start_date" required />
 * </Field>
 */
export const Field = (props) => {
  import.meta.css = css;
  const refDefault = useRef();
  props.ref = props.ref || refDefault;
  const { as } = props;

  if (as === "label") {
    return <FieldAsLabel {...props} />;
  }
  return <FieldAsContainer {...props} />;
};

const FieldAsLabel = (props) => {
  const { spacingWithControl = "s", children } = props;
  const isVertical = props.flex === "y";

  return (
    <Label
      navi-field=""
      alignX={isVertical ? "start" : undefined}
      spacing={spacingWithControl}
      {...props}
      spacingWithControl={undefined}
      data-vertical={isVertical ? "" : undefined}
    >
      {children}
    </Label>
  );
};
const FieldCSSVars = {
  spacingWithControl: "--spacing-with-control",
};
const FieldAsContainer = (props) => {
  import.meta.css = css;
  const { children } = props;
  props.spacingWithControl = resolveSpacingSize(props.spacingWithControl);
  const isVertical = props.flex === "y";
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  const messagePropsRef = useRef();
  messagePropsRef.current = messageProps;
  const idDefault = useId();
  props.fieldId = props.fieldId || `field_${idDefault}`;

  return (
    <Box
      navi-field=""
      styleCSSVars={FieldCSSVars}
      alignX={isVertical ? "start" : undefined}
      {...remainingProps}
      data-vertical={isVertical ? "" : undefined}
      fieldId={undefined}
    >
      <MessagePropsRefContext.Provider value={messagePropsRef}>
        <ControlIdContext.Provider value={props.fieldId}>
          {children}
        </ControlIdContext.Provider>
      </MessagePropsRefContext.Provider>
    </Box>
  );
};

const FIELD_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

export const Label = (props) => {
  import.meta.css = css;
  const { children } = props;
  const controlId = useContext(ControlIdContext);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [connected, setConnected] = useState(false);
  // Set htmlFor only when we know the correct target id:
  //   - caller explicitly provided one (even undefined to opt out)
  //   - a parent Field provided one via ControlIdContext
  // When neither is present the label either wraps the control directly
  // (implicit HTML association) or is disconnected — either way, a
  // randomly generated id would point to nothing and cause confusion.
  if (!Object.hasOwn(props, "htmlFor") && controlId) {
    props.htmlFor = controlId;
  }
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  const messagePropsRef = useRef();
  messagePropsRef.current = messageProps;

  return (
    <Box
      as="label"
      baseClassName="navi_label"
      pseudoClasses={FIELD_PSEUDO_CLASSES}
      data-control-connected={connected ? "" : undefined}
      basePseudoState={{
        ":disabled": disabled,
        ":read-only": readOnly,
      }}
      {...remainingProps}
      onnavi_control_state={(e) => {
        setConnected(true);
        setDisabled(e.detail.disabled);
        setReadOnly(e.detail.readOnly);
      }}
      onnavi_control_disconnected={() => {
        setConnected(false);
        setDisabled(false);
        setReadOnly(false);
      }}
    >
      <MessagePropsRefContext.Provider value={messagePropsRef}>
        <ControlIdContext.Provider value={props.htmlFor}>
          {children}
        </ControlIdContext.Provider>
      </MessagePropsRefContext.Provider>
    </Box>
  );
};
