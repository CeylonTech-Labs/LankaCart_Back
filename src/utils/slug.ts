export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const uniqueSlug = (value: string) => `${slugify(value)}-${Date.now().toString(36)}`;
