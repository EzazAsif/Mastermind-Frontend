// JS version to avoid TS errors in JS projects
export function getPublicUrl(img) {
  if (!img) return "";
  // Already absolute: http(s)://, //, data:, blob:
  if (/^(https?:)?\/\//i.test(img) || /^data:|^blob:/.test(img)) {
    return img;
  }
  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";
  if (img.startsWith("/")) return `${API_BASE}${img}`;
  return `${API_BASE}/${img}`;
}
