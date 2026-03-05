export const LABEL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: "bg-blue-100 dark:bg-blue-950",     text: "text-blue-700 dark:text-blue-300",     dot: "bg-blue-500" },
  green:  { bg: "bg-green-100 dark:bg-green-950",   text: "text-green-700 dark:text-green-300",   dot: "bg-green-500" },
  purple: { bg: "bg-purple-100 dark:bg-purple-950",  text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  amber:  { bg: "bg-amber-100 dark:bg-amber-950",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  red:    { bg: "bg-red-100 dark:bg-red-950",       text: "text-red-700 dark:text-red-300",       dot: "bg-red-500" },
  pink:   { bg: "bg-pink-100 dark:bg-pink-950",     text: "text-pink-700 dark:text-pink-300",     dot: "bg-pink-500" },
  cyan:   { bg: "bg-cyan-100 dark:bg-cyan-950",     text: "text-cyan-700 dark:text-cyan-300",     dot: "bg-cyan-500" },
  orange: { bg: "bg-orange-100 dark:bg-orange-950",  text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  slate:  { bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-700 dark:text-slate-300",   dot: "bg-slate-500" },
};

export const COLOR_NAMES = Object.keys(LABEL_COLORS);

export function getLabelColor(color: string) {
  return LABEL_COLORS[color] || LABEL_COLORS.slate;
}
