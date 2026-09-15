/** Formats a date with minute precision, matching the "fr-FR" date
 * convention already used everywhere else in the app regardless of UI
 * locale (see AGENTS.md / established codebase pattern). */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
