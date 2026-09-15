import { getSystemSettings } from "@/features/settings/queries";

const TOKEN_MAP = {
  primary: "--primary",
  secondary: "--secondary",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  header: "--header",
  background: "--background",
  text: "--foreground",
  button: "--button",
  accent: "--accent",
} as const;

function toDeclarations(colors: Record<keyof typeof TOKEN_MAP, string>) {
  return Object.entries(TOKEN_MAP)
    .map(([key, cssVar]) => `${cssVar}:${colors[key as keyof typeof TOKEN_MAP]};`)
    .join("");
}

/**
 * Renders the branding colors as a CSS string that overrides the default
 * tokens in globals.css. Rendered once in the root layout so an admin
 * change on the Appearance page — or a company.ts edit, for fields left
 * unset in the DB — takes effect app-wide immediately, no build step.
 */
export async function getThemeCss(): Promise<string> {
  const { colorsLight, colorsDark } = await getSystemSettings();
  return `:root{${toDeclarations(colorsLight)}}.dark{${toDeclarations(colorsDark)}}`;
}
