/* eslint-disable block-scoped-var */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-negated-condition */
/* eslint-disable consistent-return */
/* eslint-disable prefer-spread */
/* eslint-disable no-void */
/* eslint-disable no-sequences */
import toArray from "../toArray/toArray.js";
import toPropertyKey from "../toPropertyKey/toPropertyKey.js";

// ClassDefinitionEvaluation (Steps 26-*)
export default function _decorate(
  decorators /* : ClassDecorator[] */,
  factory /* : ClassFactory */,
  superClass /* : ?Class<*> */,
  mixins /* : ?Array<Function> */,
) /* : Class<*> */ {
  var api = _getDecoratorsApi();
  if (mixins) {
    for (var i = 0; i < mixins.length; i++) {
      api = mixins[i](api);
    }
  }
  var r = factory(function initialize(O) {
    api.initializeInstanceElements(O, decorated.elements);
  }, superClass);
  var decorated = api.decorateClass(
    _coalesceClassElements(r.d.map(_createElementDescriptor)),
    decorators,
  );
  api.initializeClassElements(r.F, decorated.elements);
  return api.runClassFinishers(r.F, decorated.finishers);
}

var _getDecoratorsApi = function () {
  var api = {
    elementsDefinitionOrder: [["method"], ["field"]],
    // InitializeInstanceElements
    initializeInstanceElements(
      /* ::<C>*/ O /* : C */,
      elements /* : ElementDescriptor[] */,
    ) {
      ["method", "field"].forEach(function (kind) {
        elements.forEach(function (element /* : ElementDescriptor */) {
          if (element.kind === kind && element.placement === "own") {
            this.defineClassElement(O, element);
          }
        }, this);
      }, this);
    },
    // InitializeClassElements
    initializeClassElements(
      /* ::<C>*/ F /* : Class<C> */,
      elements /* : ElementDescriptor[] */,
    ) {
      var proto = F.prototype;
      ["method", "field"].forEach(function (kind) {
        elements.forEach(function (element /* : ElementDescriptor */) {
          var placement = element.placement;
          if (
            element.kind === kind &&
            (placement === "static" || placement === "prototype")
          ) {
            var receiver = placement === "static" ? F : proto;
            this.defineClassElement(receiver, element);
          }
        }, this);
      }, this);
    },
    // DefineClassElement
    defineClassElement(
      /* ::<C>*/ receiver /* : C | Class<C> */,
      element /* : ElementDescriptor */,
    ) {
      var descriptor /* : PropertyDescriptor */ = element.descriptor;
      if (element.kind === "field") {
        var initializer = element.initializer;
        descriptor = {
          enumerable: descriptor.enumerable,
          writable: descriptor.writable,
          configurable: descriptor.configurable,
          value: initializer === void 0 ? void 0 : initializer.call(receiver),
        };
      }
      Object.defineProperty(receiver, element.key, descriptor);
    },
    // DecorateClass
    decorateClass(
      elements /* : ElementDescriptor[] */,
      decorators /* : ClassDecorator[] */,
    ) /* : ElementsFinishers */ {
      var newElements /* : ElementDescriptor[] */ = [];
      var finishers /* : ClassFinisher[] */ = [];
      var placements /* : Placements */ = {
        static: [],
        prototype: [],
        own: [],
      };
      elements.forEach(function (element /* : ElementDescriptor */) {
        this.addElementPlacement(element, placements);
      }, this);
      elements.forEach(function (element /* : ElementDescriptor */) {
        if (!_hasDecorators(element)) return newElements.push(element);
        var elementFinishersExtras /* : ElementFinishersExtras */ =
          this.decorateElement(element, placements);
        newElements.push(elementFinishersExtras.element);
        newElements.push.apply(newElements, elementFinishersExtras.extras);
        finishers.push.apply(finishers, elementFinishersExtras.finishers);
      }, this);
      if (!decorators) {
        return { elements: newElements, finishers };
      }
      var result /* : ElementsFinishers */ = this.decorateConstructor(
        newElements,
        decorators,
      );
      finishers.push.apply(finishers, result.finishers);
      result.finishers = finishers;
      return result;
    },
    // AddElementPlacement
    addElementPlacement(
      element /* : ElementDescriptor */,
      placements /* : Placements */,
      silent /* : boolean */,
    ) {
      var keys = placements[element.placement];
      if (!silent && keys.indexOf(element.key) !== -1) {
        throw new TypeError(`Duplicated element (${element.key})`);
      }
      keys.push(element.key);
    },
    // DecorateElement
    decorateElement(
      element /* : ElementDescriptor */,
      placements /* : Placements */,
    ) /* : ElementFinishersExtras */ {
      var extras /* : ElementDescriptor[] */ = [];
      var finishers /* : ClassFinisher[] */ = [];
      for (
        var decorators = element.decorators, i = decorators.length - 1;
        i >= 0;
        i--
      ) {
        // (inlined) RemoveElementPlacement
        var keys = placements[element.placement];
        keys.splice(keys.indexOf(element.key), 1);
        var elementObject /* : ElementObjectInput */ =
          this.fromElementDescriptor(element);
        var elementFinisherExtras /* : ElementFinisherExtras */ =
          this.toElementFinisherExtras(
            (0, decorators[i])(elementObject) /* : ElementObjectOutput */ ||
              elementObject,
          );
        element = elementFinisherExtras.element;
        this.addElementPlacement(element, placements);
        if (elementFinisherExtras.finisher) {
          finishers.push(elementFinisherExtras.finisher);
        }
        var newExtras /* : ElementDescriptor[] | void */ =
          elementFinisherExtras.extras;
        if (newExtras) {
          for (var j = 0; j < newExtras.length; j++) {
            this.addElementPlacement(newExtras[j], placements);
          }
          extras.push.apply(extras, newExtras);
        }
      }
      return { element, finishers, extras };
    },
    // DecorateConstructor
    decorateConstructor(
      elements /* : ElementDescriptor[] */,
      decorators /* : ClassDecorator[] */,
    ) /* : ElementsFinishers */ {
      var finishers /* : ClassFinisher[] */ = [];
      for (var i = decorators.length - 1; i >= 0; i--) {
        var obj /* : ClassObject */ = this.fromClassDescriptor(elements);
        var elementsAndFinisher /* : ElementsFinisher */ =
          this.toClassDescriptor(
            (0, decorators[i])(obj) /* : ClassObject */ || obj,
          );
        if (elementsAndFinisher.finisher !== undefined) {
          finishers.push(elementsAndFinisher.finisher);
        }
        if (elementsAndFinisher.elements !== undefined) {
          elements = elementsAndFinisher.elements;
          for (var j = 0; j < elements.length - 1; j++) {
            for (var k = j + 1; k < elements.length; k++) {
              if (
                elements[j].key === elements[k].key &&
                elements[j].placement === elements[k].placement
              ) {
                throw new TypeError(`Duplicated element (${elements[j].key})`);
              }
            }
          }
        }
      }
      return { elements, finishers };
    },
    // FromElementDescriptor
    fromElementDescriptor(
      element /* : ElementDescriptor */,
    ) /* : ElementObject */ {
      var obj /* : ElementObject */ = {
        kind: element.kind,
        key: element.key,
        placement: element.placement,
        descriptor: element.descriptor,
      };
      var desc = {
        value: "Descriptor",
        configurable: true,
      };
      Object.defineProperty(obj, Symbol.toStringTag, desc);
      if (element.kind === "field") obj.initializer = element.initializer;
      return obj;
    },
    // ToElementDescriptors
    toElementDescriptors(
      elementObjects /* : ElementObject[] */,
    ) /* : ElementDescriptor[] */ {
      if (elementObjects === undefined) return;
      return toArray(elementObjects).map(function (elementObject) {
        var element = this.toElementDescriptor(elementObject);
        this.disallowProperty(
          elementObject,
          "finisher",
          "An element descriptor",
        );
        this.disallowProperty(elementObject, "extras", "An element descriptor");
        return element;
      }, this);
    },
    // ToElementDescriptor
    toElementDescriptor(
      elementObject /* : ElementObject */,
    ) /* : ElementDescriptor */ {
      var kind = String(elementObject.kind);
      if (kind !== "method" && kind !== "field") {
        throw new TypeError(
          `${
            'An element descriptor\'s .kind property must be either "method" or' +
            ' "field", but a decorator created an element descriptor with' +
            ' .kind "'
          }${kind}"`,
        );
      }
      var key = toPropertyKey(elementObject.key);
      var placement = String(elementObject.placement);
      if (
        placement !== "static" &&
        placement !== "prototype" &&
        placement !== "own"
      ) {
        throw new TypeError(
          `${
            'An element descriptor\'s .placement property must be one of "static",' +
            ' "prototype" or "own", but a decorator created an element descriptor' +
            ' with .placement "'
          }${placement}"`,
        );
      }
      var descriptor /* : PropertyDescriptor */ = elementObject.descriptor;
      this.disallowProperty(elementObject, "elements", "An element descriptor");
      var element /* : ElementDescriptor */ = {
        kind,
        key,
        placement,
        descriptor: Object.assign({}, descriptor),
      };
      if (kind !== "field") {
        this.disallowProperty(
          elementObject,
          "initializer",
          "A method descriptor",
        );
      } else {
        this.disallowProperty(
          descriptor,
          "get",
          "The property descriptor of a field descriptor",
        );
        this.disallowProperty(
          descriptor,
          "set",
          "The property descriptor of a field descriptor",
        );
        this.disallowProperty(
          descriptor,
          "value",
          "The property descriptor of a field descriptor",
        );
        element.initializer = elementObject.initializer;
      }
      return element;
    },
    toElementFinisherExtras(
      elementObject /* : ElementObject */,
    ) /* : ElementFinisherExtras */ {
      var element /* : ElementDescriptor */ =
        this.toElementDescriptor(elementObject);
      var finisher /* : ClassFinisher */ = _optionalCallableProperty(
        elementObject,
        "finisher",
      );
      var extras /* : ElementDescriptors[] */ = this.toElementDescriptors(
        elementObject.extras,
      );
      return { element, finisher, extras };
    },
    // FromClassDescriptor
    fromClassDescriptor(
      elements /* : ElementDescriptor[] */,
    ) /* : ClassObject */ {
      var obj = {
        kind: "class",
        elements: elements.map(this.fromElementDescriptor, this),
      };
      var desc = { value: "Descriptor", configurable: true };
      Object.defineProperty(obj, Symbol.toStringTag, desc);
      return obj;
    },
    // ToClassDescriptor
    toClassDescriptor(obj /* : ClassObject */) /* : ElementsFinisher */ {
      var kind = String(obj.kind);
      if (kind !== "class") {
        throw new TypeError(
          `${
            'A class descriptor\'s .kind property must be "class", but a decorator' +
            ' created a class descriptor with .kind "'
          }${kind}"`,
        );
      }
      this.disallowProperty(obj, "key", "A class descriptor");
      this.disallowProperty(obj, "placement", "A class descriptor");
      this.disallowProperty(obj, "descriptor", "A class descriptor");
      this.disallowProperty(obj, "initializer", "A class descriptor");
      this.disallowProperty(obj, "extras", "A class descriptor");
      var finisher = _optionalCallableProperty(obj, "finisher");
      var elements = this.toElementDescriptors(obj.elements);
      return { elements, finisher };
    },
    // RunClassFinishers
    runClassFinishers(
      constructor /* : Class<*> */,
      finishers /* : ClassFinisher[] */,
    ) /* : Class<*> */ {
      for (var i = 0; i < finishers.length; i++) {
        var newConstructor /* : ?Class<*> */ = (0, finishers[i])(constructor);
        if (newConstructor !== undefined) {
          // NOTE: This should check if IsConstructor(newConstructor) is false.
          if (typeof newConstructor !== "function") {
            throw new TypeError("Finishers must return a constructor.");
          }
          constructor = newConstructor;
        }
      }
      return constructor;
    },
    disallowProperty(obj, name, objectType) {
      if (obj[name] !== undefined) {
        throw new TypeError(`${objectType} can't have a .${name} property.`);
      }
    },
  };
  _getDecoratorsApi = function () {
    return api;
  };
  return api;
};

// ClassElementEvaluation
function _createElementDescriptor(
  def /* : ElementDefinition */,
) /* : ElementDescriptor */ {
  var key = toPropertyKey(def.key);
  var descriptor; /* : PropertyDescriptor */
  if (def.kind === "method") {
    descriptor = {
      value: def.value,
      writable: true,
      configurable: true,
      enumerable: false,
    };
  } else if (def.kind === "get") {
    descriptor = { get: def.value, configurable: true, enumerable: false };
  } else if (def.kind === "set") {
    descriptor = { set: def.value, configurable: true, enumerable: false };
  } else if (def.kind === "field") {
    descriptor = { configurable: true, writable: true, enumerable: true };
  }
  var element /* : ElementDescriptor */ = {
    kind: def.kind === "field" ? "field" : "method",
    key,
    placement: def.static
      ? "static"
      : def.kind === "field"
        ? "own"
        : "prototype",
    descriptor,
  };
  if (def.decorators) element.decorators = def.decorators;
  if (def.kind === "field") element.initializer = def.value;
  return element;
}
// CoalesceGetterSetter
function _coalesceGetterSetter(
  element /* : ElementDescriptor */,
  other /* : ElementDescriptor */,
) {
  if (element.descriptor.get !== undefined) {
    other.descriptor.get = element.descriptor.get;
  } else {
    other.descriptor.set = element.descriptor.set;
  }
}
// CoalesceClassElements
function _coalesceClassElements(
  elements /* : ElementDescriptor[] */,
) /* : ElementDescriptor[] */ {
  var newElements /* : ElementDescriptor[] */ = [];
  var isSameElement = function (
    other /* : ElementDescriptor */,
  ) /* : boolean */ {
    return (
      other.kind === "method" &&
      other.key === element.key &&
      other.placement === element.placement
    );
  };
  for (var i = 0; i < elements.length; i++) {
    var element /* : ElementDescriptor */ = elements[i];
    var other; /* : ElementDescriptor */
    if (
      element.kind === "method" &&
      (other = newElements.find(isSameElement))
    ) {
      if (
        _isDataDescriptor(element.descriptor) ||
        _isDataDescriptor(other.descriptor)
      ) {
        if (_hasDecorators(element) || _hasDecorators(other)) {
          throw new ReferenceError(
            `Duplicated methods (${element.key}) can't be decorated.`,
          );
        }
        other.descriptor = element.descriptor;
      } else {
        if (_hasDecorators(element)) {
          if (_hasDecorators(other)) {
            throw new ReferenceError(
              `${
                "Decorators can't be placed on different accessors with for " +
                "the same property ("
              }${element.key}).`,
            );
          }
          other.decorators = element.decorators;
        }
        _coalesceGetterSetter(element, other);
      }
    } else {
      newElements.push(element);
    }
  }
  return newElements;
}
function _hasDecorators(element /* : ElementDescriptor */) /* : boolean */ {
  return element.decorators && element.decorators.length;
}
function _isDataDescriptor(desc /* : PropertyDescriptor */) /* : boolean */ {
  return (
    desc !== undefined &&
    !(desc.value === undefined && desc.writable === undefined)
  );
}
function _optionalCallableProperty /* ::<T>*/(
  obj /* : T */,
  name /* : $Keys<T> */,
) /* : ?Function */ {
  var value = obj[name];
  if (value !== undefined && typeof value !== "function") {
    throw new TypeError(`Expected '${name}' to be a function`);
  }
  return value;
}
