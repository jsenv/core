import { Badge } from "./badge.jsx";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge_list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--badge-list-gap, 0.5em);
  }
`;

export const BadgeList = ({ badges, children, className, ...props }) => {
  import.meta.css = css;
  const resolvedClassName = className
    ? `navi_badge_list ${className}`
    : "navi_badge_list";

  if (badges) {
    return (
      <div className={resolvedClassName} {...props}>
        {badges.map((badge, i) => {
          if (typeof badge === "string") {
            return <Badge key={i}>{badge}</Badge>;
          }
          const { label, ...badgeProps } = badge;
          return (
            <Badge key={i} {...badgeProps}>
              {label}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className={resolvedClassName} {...props}>
      {children}
    </div>
  );
};
