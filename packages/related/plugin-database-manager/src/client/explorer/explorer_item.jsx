import {
  Editable,
  FontSizedSvg,
  Input,
  Overflow,
  useEditableController,
  useSignalSync,
} from "@jsenv/navi";
import {
  createUniqueValueConstraint,
  SINGLE_SPACE_CONSTRAINT,
} from "@jsenv/validation";
import { useSignal } from "@preact/signals";

export const ExplorerItem = ({
  nameKey,
  item,
  renderItem,
  deletedItems,
  useItemArrayInStore,
  useRenameItemAction,
  useDeleteItemAction,
}) => {
  const itemName = item[nameKey];

  const { editable, startEditing, stopEditing } = useEditableController();
  const deleteItemAction = useDeleteItemAction
    ? useDeleteItemAction(item)
    : null;

  const itemRendered = renderItem(item, {
    deletedItems,
    className: "explorer_item_content",
    shortcuts: [
      {
        key: "enter",
        enabled: !editable,
        action: startEditing,
        description: "Edit item name",
      },
      ...(deleteItemAction
        ? [
            {
              key: "command+delete",
              action: deleteItemAction,
              description: "Delete item",
              confirmMessage: `Are you sure you want to delete "${itemName}"?`,
            },
          ]
        : []),
    ],
    children: useRenameItemAction ? (
      <RenameInputOrName
        nameKey={nameKey}
        item={item}
        useItemArrayInStore={useItemArrayInStore}
        useRenameItemAction={useRenameItemAction}
        editable={editable}
        stopEditing={stopEditing}
      />
    ) : (
      <Overflow>{itemName}</Overflow>
    ),
  });
  return itemRendered;
};

const RenameInputOrName = ({
  nameKey,
  item,
  useItemArrayInStore,
  useRenameItemAction,
  editable,
  stopEditing,
}) => {
  const itemName = item[nameKey];
  const nameSignal = useSignalSync(itemName);

  const renameAction = useRenameItemAction(item, nameSignal);

  const itemArrayInStore = useItemArrayInStore();
  const otherValueSet = new Set();
  for (const itemCandidate of itemArrayInStore) {
    if (itemCandidate === item) {
      continue;
    }
    otherValueSet.add(itemCandidate[nameKey]);
  }
  const uniqueNameConstraint = createUniqueValueConstraint(
    otherValueSet,
    `"{value}" already exist, please choose another name.`,
  );

  return (
    <Editable
      action={renameAction}
      editable={editable}
      onEditEnd={stopEditing}
      value={itemName}
      valueSignal={nameSignal}
      inputProps={{
        constraints: [SINGLE_SPACE_CONSTRAINT, uniqueNameConstraint],
      }}
    >
      <Overflow>{itemName}</Overflow>
    </Editable>
  );
};

export const ExplorerNewItem = ({
  nameKey,
  useItemArrayInStore,
  useCreateItemAction,
  cancelOnBlurInvalid,
  onCancel,
  onActionEnd,
}) => {
  const nameSignal = useSignal("");
  const createItemAction = useCreateItemAction(nameSignal);
  const itemArrayInStore = useItemArrayInStore();
  const valueSet = new Set();
  for (const item of itemArrayInStore) {
    valueSet.add(item[nameKey]);
  }
  const uniqueNameConstraint = createUniqueValueConstraint(
    valueSet,
    `"{value}" already exists. Please choose an other name.`,
  );

  return (
    <span className="explorer_item_content">
      <FontSizedSvg>
        <EnterNameIconSvg />
      </FontSizedSvg>

      <Input
        action={createItemAction}
        valueSignal={nameSignal}
        cancelOnEscape
        cancelOnBlurInvalid={cancelOnBlurInvalid}
        onCancel={onCancel}
        onActionEnd={onActionEnd}
        autoFocus
        required
        constraints={[SINGLE_SPACE_CONSTRAINT, uniqueNameConstraint]}
      />
    </span>
  );
};

const EnterNameIconSvg = ({ color = "currentColor" }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M21.1213 2.70705C19.9497 1.53548 18.0503 1.53547 16.8787 2.70705L15.1989 4.38685L7.29289 12.2928C7.16473 12.421 7.07382 12.5816 7.02986 12.7574L6.02986 16.7574C5.94466 17.0982 6.04451 17.4587 6.29289 17.707C6.54127 17.9554 6.90176 18.0553 7.24254 17.9701L11.2425 16.9701C11.4184 16.9261 11.5789 16.8352 11.7071 16.707L19.5556 8.85857L21.2929 7.12126C22.4645 5.94969 22.4645 4.05019 21.2929 2.87862L21.1213 2.70705ZM18.2929 4.12126C18.6834 3.73074 19.3166 3.73074 19.7071 4.12126L19.8787 4.29283C20.2692 4.68336 20.2692 5.31653 19.8787 5.70705L18.8622 6.72357L17.3068 5.10738L18.2929 4.12126ZM15.8923 6.52185L17.4477 8.13804L10.4888 15.097L8.37437 15.6256L8.90296 13.5112L15.8923 6.52185ZM4 7.99994C4 7.44766 4.44772 6.99994 5 6.99994H10C10.5523 6.99994 11 6.55223 11 5.99994C11 5.44766 10.5523 4.99994 10 4.99994H5C3.34315 4.99994 2 6.34309 2 7.99994V18.9999C2 20.6568 3.34315 21.9999 5 21.9999H16C17.6569 21.9999 19 20.6568 19 18.9999V13.9999C19 13.4477 18.5523 12.9999 18 12.9999C17.4477 12.9999 17 13.4477 17 13.9999V18.9999C17 19.5522 16.5523 19.9999 16 19.9999H5C4.44772 19.9999 4 19.5522 4 18.9999V7.99994Z"
        fill={color}
      />
    </svg>
  );
};
