import { useContext } from "preact/hooks";

import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { EmailSvg } from "@jsenv/navi/src/graphic/icons/email_svg.jsx";
import { PhoneSvg } from "@jsenv/navi/src/graphic/icons/phone_svg.jsx";
import { SearchSvg } from "@jsenv/navi/src/graphic/icons/search_svg.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Button } from "./button.jsx";
import { InputIconSlot, InputRightSlot } from "./input_components.jsx";
import { InputTextualContext } from "./input_textual_context.js";

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
  const { value, id } = useContext(InputTextualContext);
  const searchIcon = icon === undefined ? <SearchSvg /> : icon;
  const hasValue = Boolean(value);

  if (!hasValue) {
    if (!searchIcon) {
      return null;
    }
    return <InputIconSlot>{searchIcon}</InputIconSlot>;
  }
  return (
    <InputRightSlot>
      <Button
        command="--navi-clear"
        commandFor={id}
        tabIndex="-1"
        navi-focus-delegate={id}
        icon
        variant="discrete"
      >
        <Icon>
          <CloseSvg />
        </Icon>
      </Button>
    </InputRightSlot>
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
    <InputIconSlot>
      <EmailSvg />
    </InputIconSlot>
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
    <InputIconSlot>
      <PhoneSvg />
    </InputIconSlot>
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
