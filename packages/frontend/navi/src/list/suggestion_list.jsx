import { List, ListItem } from "./list.jsx";

/**
 * SuggestionList — a keyboard-navigable, filterable listbox.
 */
export const SuggestionList = (props) => {
  return <List listRole="listbox" fallback="No results" {...props} />;
};

/**
 * Suggestion — a selectable option inside SuggestionList.
 *
 * Thin wrapper over <ListItem> that adds role="option" and ARIA attributes.
 * Search-based hiding and text highlighting are handled by <ListItem>.
 */
export const Suggestion = ({ value, hidden, selected, children, ...rest }) => {
  return (
    <ListItem
      role="option"
      hidden={hidden}
      id={value}
      value={value}
      selected={selected}
      baseClassName="navi_list_item navi_suggestion"
      {...rest}
    >
      {children}
    </ListItem>
  );
};
