import {
  createBlankNode,
  createBorderBottomLeftNode,
  createBorderBottomNode,
  createBorderBottomRightNode,
  createBorderHalfDownNode,
  createBorderHalfLeftNode,
  createBorderHalfRightNode,
  createBorderHalfUpNode,
  createBorderLeftNode,
  createBorderMidBottomNode,
  createBorderMidLeftNode,
  createBorderMidNode,
  createBorderMidRightNode,
  createBorderMidTopNode,
  createBorderRightNode,
  createBorderTopLeftNode,
  createBorderTopNode,
  createBorderTopRightNode,
} from "./border_nodes.js";
import {
  createSkippedColumnBottomNode,
  createSkippedColumnBottomRightNode,
  createSkippedColumnTopNode,
  createSkippedColumnTopRightNode,
  createSkippedRowBottomLeftNode,
  createSkippedRowBottomRightNode,
  createSkippedRowLeftNode,
  createSkippedRowRightNode,
} from "./skip_nodes.js";

export const leftSlot = {
  type: "left",
  adapt: (cell) => {
    const { isSkippedRow, borderLeft } = cell;
    if (isSkippedRow) {
      return createSkippedRowLeftNode();
    }
    if (borderLeft) {
      return createBorderLeftNode(borderLeft);
    }
    return createBlankNode();
  },
};
export const rightSlot = {
  type: "right",
  adapt: (cell) => {
    const { isSkippedColumn, isSkippedRow, borderRight } = cell;
    if (isSkippedRow) {
      return createSkippedRowRightNode();
    }
    if (isSkippedColumn) {
      return createBlankNode();
    }
    if (borderRight) {
      return createBorderRightNode(borderRight);
    }
    return createBlankNode();
  },
};
export const topSlot = {
  type: "top",
  adapt: (cell) => {
    const { isSkippedColumn, borderTop } = cell;
    if (isSkippedColumn) {
      return createSkippedColumnTopNode();
    }
    if (borderTop) {
      return createBorderTopNode(borderTop);
    }
    return createBlankNode();
  },
};
export const bottomSlot = {
  type: "bottom",
  adapt: (cell) => {
    const { isSkippedRow, isSkippedColumn, borderBottom } = cell;
    if (isSkippedColumn) {
      return createSkippedColumnBottomNode();
    }
    if (isSkippedRow) {
      return createBlankNode();
    }
    if (borderBottom) {
      return createBorderBottomNode(borderBottom);
    }
    return createBlankNode();
  },
};
export const topLeftSlot = {
  type: "top_left",
  adapt: (cell) => {
    const { borderTop, borderLeft, westCell, northCell } = cell;
    if (!borderTop && !borderLeft) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderLeft;
    let westConnected = westCell && westCell.borderTop && !westCell.borderRight;
    let northWestConnected = northConnected && westConnected;
    if (borderTop && borderLeft) {
      if (northWestConnected) {
        return createBorderMidNode(
          westCell.borderTop,
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderLeft,
          westCell.borderTop,
        );
      }
      if (northConnected) {
        return createBorderMidLeftNode(
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      return createBorderTopLeftNode(borderTop, borderLeft);
    }
    if (borderLeft) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderLeft);
      northWestConnected = northConnected && westConnected;
      if (northWestConnected) {
        return createBorderMidRightNode(
          northCell.borderLeft || northCell.westCell.borderRight,
          westCell.borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderTopRightNode(westCell.borderTop, borderLeft);
      }
      if (northConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfDownNode(borderLeft);
    }
    // borderTop
    westConnected = westCell && (westCell.borderTop || westCell.borderRight);
    northWestConnected = northConnected && westConnected;
    if (northWestConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderLeft,
        westCell.borderTop || northCell.westCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomLeftNode(borderTop, northCell.borderLeft);
    }
    if (westConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfRightNode(borderTop);
  },
};
export const topRightSlot = {
  type: "top_right",
  adapt: (cell) => {
    const { isSkippedColumn, borderTop, borderRight, eastCell, northCell } =
      cell;
    if (isSkippedColumn) {
      return createSkippedColumnTopRightNode();
    }
    if (!borderTop && !borderRight) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderRight;
    let eastConnected = eastCell && eastCell.borderTop && !eastCell.borderLeft;
    let northEastConnected = northConnected && eastConnected;
    if (borderTop && borderRight) {
      if (northEastConnected) {
        return createBorderMidNode(
          borderTop,
          northCell.borderRight,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderMidRightNode(
          northCell.borderRight,
          borderTop,
          borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderRight,
          eastCell.borderTop,
        );
      }
      return createBorderTopRightNode(borderTop, borderRight);
    }
    if (borderRight) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderRight);
      northEastConnected = northConnected && eastConnected;
      if (northEastConnected) {
        return createBorderMidLeftNode(
          northCell.borderRight || northCell.eastCell.borderLeft,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderRightNode(
          northCell.borderRight || northCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderTopLeftNode(eastCell.borderTop, borderRight);
      }
      return createBorderHalfDownNode(borderRight);
    }
    // borderTop
    eastConnected = eastCell && (eastCell.borderTop || eastCell.borderLeft);
    northEastConnected = northConnected && eastConnected;
    if (northEastConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderRight,
        eastCell.borderTop || eastCell.northCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomRightNode(borderTop, northCell.borderRight);
    }
    if (eastConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfLeftNode(borderTop);
  },
};
export const bottomRightSlot = {
  type: "bottom_right",
  adapt: (cell) => {
    const {
      isSkippedRow,
      isSkippedColumn,
      borderBottom,
      borderRight,
      eastCell,
      southCell,
    } = cell;
    if (isSkippedRow) {
      return createSkippedRowBottomRightNode();
    }
    if (isSkippedColumn) {
      return createSkippedColumnBottomRightNode();
    }
    if (!borderBottom && !borderRight) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderRight;
    let eastConnected =
      eastCell && eastCell.borderBottom && !eastCell.borderLeft;
    let southEastConnected = southConnected && eastConnected;
    if (borderBottom && borderRight) {
      if (southEastConnected) {
        return createBorderMidNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
          southCell.borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
        );
      }
      if (southConnected) {
        return createBorderMidRightNode(
          borderRight,
          borderBottom,
          southCell.borderRight,
        );
      }
      return createBorderBottomRightNode(borderBottom, borderRight);
    }
    if (borderRight) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderRight);
      southEastConnected = southConnected && eastConnected;
      if (southEastConnected) {
        return createBorderMidTopNode(
          borderRight,
          southCell.borderTop || southCell.eastCell.borderBottom,
          eastCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderBottomLeftNode(eastCell.borderBottom, borderRight);
      }
      if (southConnected) {
        return createBorderRightNode(borderRight);
      }
      return createBorderHalfUpNode(borderRight);
    }
    // border bottom
    eastConnected = eastCell && (eastCell.borderBottom || eastCell.borderLeft);
    southEastConnected = southConnected && eastConnected;
    if (southEastConnected) {
      return createBorderMidTopNode(
        borderBottom,
        southCell.borderRight,
        eastCell.borderBottom || eastCell.southCell.borderTop,
      );
    }
    if (southConnected) {
      return createBorderTopRightNode(borderBottom, southCell.borderRight);
    }
    if (eastConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfLeftNode(borderBottom);
  },
};
export const bottomLeftSlot = {
  type: "bottom_left",
  adapt: (cell) => {
    const { isSkippedRow, borderBottom, borderLeft, westCell, southCell } =
      cell;
    if (isSkippedRow) {
      return createSkippedRowBottomLeftNode();
    }
    if (!borderBottom && !borderLeft) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderLeft;
    let westConnected =
      westCell && westCell.borderBottom && !westCell.borderRight;
    let southWestConnected = southConnected && westConnected;
    if (borderBottom && borderLeft) {
      if (southWestConnected) {
        return createBorderMidNode(
          westCell.borderBottom,
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (southConnected) {
        return createBorderMidLeftNode(
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderLeft,
          westCell.borderBottom,
        );
      }
      return createBorderBottomLeftNode(borderBottom, borderLeft);
    }
    if (borderLeft) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderLeft);
      southWestConnected = southConnected && westConnected;
      if (southWestConnected) {
        return createBorderMidRightNode(
          borderLeft,
          southCell.borderTop || southCell.westCell.borderBottom,
          southCell.borderLeft || southCell.westCell.borderRight,
        );
      }
      if (westConnected) {
        return createBorderBottomRightNode(westCell.borderBottom, borderLeft);
      }
      if (southConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfUpNode(borderLeft);
    }
    // borderBottom
    westConnected = westCell && (westCell.borderBottom || westCell.borderRight);
    southWestConnected = southConnected && westConnected;
    if (southWestConnected) {
      return createBorderMidTopNode(
        westCell.borderBottom || southCell.borderTop,
        southCell.borderLeft,
        borderBottom,
      );
    }
    if (southConnected) {
      return createBorderTopLeftNode(borderBottom, southCell.borderLeft);
    }
    if (westConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfRightNode(borderBottom);
  },
};
