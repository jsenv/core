import { useContext } from "preact/hooks";

import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { EmailSvg } from "@jsenv/navi/src/graphic/icons/email_svg.jsx";
import { PhoneSvg } from "@jsenv/navi/src/graphic/icons/phone_svg.jsx";
import { SearchSvg } from "@jsenv/navi/src/graphic/icons/search_svg.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { triggerStringAction } from "../string_actions.js";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
import { InputTextualContext } from "./input_textual_context.js";
import { InputLeftSlot, InputRightSlot } from "./input_ui_components.jsx";

export const InputTypeResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "search") {
    return <InputSearch {...props} />;
  }
  if (props.type === "email") {
    return <InputEmail {...props} />;
  }
  if (props.type === "tel") {
    return <InputTel {...props} />;
  }
  if (props.type === "number") {
    return <InputNumber {...props} />;
  }
  if (props.type === "color") {
    return <InputColor {...props} />;
  }
  if (props.type === "datetime-local") {
    return <InputDatetimeLocal {...props} />;
  }
  return <Next {...props} />;
};

const InputSearch = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputSearchUI icon={props.icon} />} {...props} />;
};
const InputSearchUI = ({ icon }) => {
  const ctx = useContext(InputTextualContext);
  const { id } = ctx;

  return (
    <>
      {icon === undefined && (
        <InputLeftSlot>
          <Icon color="rgba(28, 43, 52, 0.5)">
            <SearchSvg />
          </Icon>
        </InputLeftSlot>
      )}
      <InputRightSlot
        hideWhileEmpty
        action-target={id}
        onClick={(e) => {
          const input = e.currentTarget;
          const allowed = dispatchRequestInteraction(input, e);
          if (allowed) {
            triggerStringAction("clear", e, { skipClose: true });
          }
        }}
      >
        <Icon color="rgba(28, 43, 52, 0.5)">
          <CloseSvg />
        </Icon>
      </InputRightSlot>
    </>
  );
};
const InputEmail = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputEmailUI />} {...props} />;
};
const InputEmailUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputLeftSlot>
      <Icon color="rgba(28, 43, 52, 0.5)">
        <EmailSvg />
      </Icon>
    </InputLeftSlot>
  );
};
const InputTel = (props) => {
  const Next = useNextResolver();
  return <Next ui={<InputTelUI icon={props.icon} />} {...props} />;
};
const InputTelUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputLeftSlot>
      <Icon color="rgba(28, 43, 52, 0.5)">
        <PhoneSvg />
      </Icon>
    </InputLeftSlot>
  );
};
const InputNumber = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputColor = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputDatetimeLocal = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
