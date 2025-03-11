var REACT_ELEMENT_TYPE;

export default function _createRawReactElement(type, props, key, children) {
  if (!REACT_ELEMENT_TYPE) {
    REACT_ELEMENT_TYPE =
      (typeof Symbol === "function" &&
        // "for" is a reserved keyword in ES3 so escaping it here for backward compatibility
        Symbol["for"] &&
        Symbol["for"]("react.element")) ||
      0xeac7;
  }

  var defaultProps = type && type.defaultProps;
  var childrenLength = arguments.length - 3;

  if (!props && childrenLength !== 0) {
    // If we're going to assign props.children, we create a new object now
    // to avoid mutating defaultProps.
    props = { children: void 0 };
  }

  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = new Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 3];
    }
    props.children = childArray;
  }

  if (props && defaultProps) {
    for (var propName in defaultProps) {
      if (props[propName] === void 0) {
        props[propName] = defaultProps[propName];
      }
    }
  } else if (!props) {
    props = defaultProps || {};
  }

  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key === undefined ? null : "" + key,
    ref: null,
    props: props,
    _owner: null,
  };
}
