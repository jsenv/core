import { FontSizedSvg } from "../components/font_sized_svg.jsx";
import { CurrentSvg } from "../icons/icons.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
import { useCurrentDatabase } from "./database_signals.js";

export const DatabaseItem = ({ database }) => {
  const currentDatabase = useCurrentDatabase();
  const isCurrent =
    currentDatabase && database.datname === currentDatabase.datname;

  return (
    <>
      <FontSizedSvg>
        <DatabaseSvg color="#333" />
      </FontSizedSvg>
      {isCurrent ? (
        <FontSizedSvg>
          <CurrentSvg />
        </FontSizedSvg>
      ) : null}
    </>
  );
};
