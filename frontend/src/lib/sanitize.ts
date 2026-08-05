export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

export function isBinaryOrFormData(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  return (
    (typeof FormData !== "undefined" && data instanceof FormData) ||
    (typeof Blob !== "undefined" && data instanceof Blob) ||
    (typeof File !== "undefined" && data instanceof File) ||
    (typeof ArrayBuffer !== "undefined" &&
      (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) ||
    (typeof URLSearchParams !== "undefined" &&
      data instanceof URLSearchParams) ||
    (typeof Buffer !== "undefined" && Buffer.isBuffer(data))
  );
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (isBinaryOrFormData(obj)) {
    return obj;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (isBinaryOrFormData(value)) {
      sanitized[key] = value;
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeString(item)
          : isBinaryOrFormData(item)
            ? item
            : typeof item === "object" && item !== null
              ? sanitizeObject(item)
              : item,
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
