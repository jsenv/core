import { Link } from "./link.jsx";

export const LinkAnchor = ({ href, ...props }) => {
  return (
    <Link href={href} aria-label="Permalink" color="inherit" {...props}></Link>
  );
};
