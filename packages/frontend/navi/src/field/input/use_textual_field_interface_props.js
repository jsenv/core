import { useFieldInterfaceProps } from "../field_hooks.jsx";

export const useTextualFieldInterfaceProps = (props) => {
  const { ref, type } = props;
  const inputTextualFieldProps = useFieldInterfaceProps(props, {
    fieldType: "input",
    statePropName: "value",
    defaultStatePropName: "defaultValue",
    readUIState: () => {
      const input = ref.current;
      return input.value;
    },
    getDisplayValue: getDisplayValueForType(type),
    normalizeUIState: getNormalizeUIStateForType(type),
  });
  return inputTextualFieldProps;
};

const getDisplayValueForType = (type) => {
  if (type === "datetime-local") {
    return convertToLocalTimezone;
  }
  if (type === "color") {
    return (uiState) => uiState || "#000000";
  }
  return undefined;
};
const getNormalizeUIStateForType = (type) => {
  if (type === "number") {
    return (uiStateRaw) => {
      const inputValueAsNumber = Number(uiStateRaw);
      if (isNaN(inputValueAsNumber)) {
        return uiStateRaw;
      }
      return inputValueAsNumber;
    };
  }
  if (type === "datetime-local") {
    return convertToUTCTimezone;
  }
  return undefined;
};
// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = (dateTimeString) => {
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
const convertToUTCTimezone = (localDateTimeString) => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }
  const localDate = new Date(localDateTimeString);
  if (isNaN(localDate.getTime())) {
    return localDateTimeString;
  }
  return localDate.toISOString();
};
