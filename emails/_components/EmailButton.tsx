import type { ReactNode } from "react";

/** Table borders and link borders provide sizing without box-sizing or height. */
export default function EmailButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  const background = secondary ? "#FFFFFF" : "#183777";
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%">
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              backgroundColor: background,
              border: `1px solid ${secondary ? "#416EBC" : background}`,
            }}
          >
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                backgroundColor: background,
                color: secondary ? "#183777" : "#FFFFFF",
                borderTop: `12px solid ${background}`,
                borderBottom: `12px solid ${background}`,
                borderLeft: `12px solid ${background}`,
                borderRight: `12px solid ${background}`,
                fontSize: "12px",
                lineHeight: "20px",
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
