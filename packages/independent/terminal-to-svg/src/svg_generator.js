import he from "he";

export const startGeneratingSvg = (attributes) => {
  const createElement = (name, attributes = {}) => {
    const isSelfClosing = selfClosingTags.includes(name);
    const canReceiveChild = name !== "text" && !isSelfClosing;
    const canReceiveContent = name === "text" || name === "style";

    const children = [];
    const setAttributes = (namedValues) => {
      Object.assign(attributes, namedValues);
    };

    const node = {
      name,
      content: "",
      children,
      attributes,
      isSelfClosing,
      setAttributes,
      createElement,
      appendChild: (childNode) => {
        if (!canReceiveChild) {
          throw new Error(`cannot appendChild into ${name}`);
        }
        children.push(childNode);
      },
      setContent: (value) => {
        if (!canReceiveContent) {
          throw new Error(`cannot setContent on ${name}`);
        }
        node.content = value;
      },
      renderAsString: () => {
        const renderNode = (node, { depth }) => {
          let nodeString = "";
          nodeString += `<${node.name}`;

          write_attributes: {
            const attributeNames = Object.keys(node.attributes);
            for (const attributeName of attributeNames) {
              let attributeValue = node.attributes[attributeName];
              if (
                attributeName === "width" ||
                attributeName === "height" ||
                attributeName === "x" ||
                attributeName === "y"
              ) {
                attributeValue = round(attributeValue);
              }
              if (attributeName === "viewBox") {
                attributeValue = attributeValue
                  .split(",")
                  .map((v) => round(parseFloat(v.trim())))
                  .join(", ");
              }
              nodeString += ` ${attributeName}="${attributeValue}"`;
            }
          }

          if (node.isSelfClosing) {
            nodeString += `/>`;
            return nodeString;
          }

          nodeString += `>`;
          if (node.content) {
            if (node.name !== "text") {
              nodeString += "\n  ";
              nodeString += "  ".repeat(depth);
            }
            const contentEncoded = he.encode(node.content, { decimal: false });
            nodeString += contentEncoded;
            if (node.name !== "text") {
              nodeString += "\n";
              nodeString += "  ".repeat(depth);
            }
          }
          write_children: {
            if (node.children.length > 0) {
              for (const child of node.children) {
                nodeString += "\n  ";
                nodeString += "  ".repeat(depth);
                nodeString += renderNode(child, {
                  depth: depth + 1,
                });
              }
              nodeString += "\n";
              nodeString += "  ".repeat(depth);
            }
          }
          nodeString += `</${node.name}>`;
          return nodeString;
        };

        return renderNode(node, {
          depth: 0,
        });
      },
    };

    return node;
  };

  return createElement("svg", attributes);
};

const selfClosingTags = ["path", "rect"];

// Round: Make number values smaller in output
// Eg: 14.23734 becomes 14.24
// Credit @Chris Martin: https://stackoverflow.com/a/43012696/2816869
const round = (x) => {
  const rounded = Number(`${Math.round(`${x}e2`)}e-2`);
  return rounded;
};

// const svg = startGeneratingSvg();

// svg.setAttributes({
//   width: 200,
// });
// const g = svg.createElement("g");
// g.setAttributes({
//   fill: "red",
// });
// svg.appendChild(g);

// const string = svg.renderAsString();
// console.log(string);
