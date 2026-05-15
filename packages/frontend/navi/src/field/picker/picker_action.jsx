import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useActionProps } from "../create_action_resolver.jsx";
// import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";

export const PickerAction = (props) => {
  const Next = useNextResolver();
  const actionProps = useActionProps(props);

  return (
    <Next
      {...actionProps}
      onnavi_get_managed_fields={(e) => {
        // we must check for the pickerEl content to search for a valid input because we might be a button used to validate for instance
        // no necessarily the field itself
        const pickerEl = e.currentTarget;
        const managedField = getPickerManagedField(pickerEl);
        e.respondWith(managedField);
      }}
    />
  );
};

const getPickerManagedField = (pickerEl) => {
  let pickerInput = pickerEl.querySelector(".navi_picker_input");
  let firstField;
  let sibling = pickerInput.nextElementSibling;
  while (sibling) {
    const candidate = findFieldWithName(sibling);
    if (candidate) {
      firstField = candidate;
      return firstField;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
};
const findFieldWithName = (el) => {
  const tag = el.tagName.toLowerCase();
  if ((tag === "input" || tag === "textarea" || tag === "select") && el.name) {
    return el;
  }
  for (const child of el.children) {
    const found = findFieldWithName(child);
    if (found) {
      return found;
    }
  }
  return null;
};
