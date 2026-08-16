import { sanitizeObject, isBinaryOrFormData, sanitizeString } from "../sanitize";

describe("sanitize module", () => {
  it("sanitizes HTML characters in strings", () => {
    expect(sanitizeString("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;",
    );
  });

  it("sanitizes plain JSON objects recursively", () => {
    const raw = {
      name: "   John <Doe>  ",
      nested: {
        comment: "Hello & Goodbye",
      },
      tags: ["<b>tag1</b>", 123],
    };

    const sanitized = sanitizeObject(raw);
    expect(sanitized.name).toBe("John &lt;Doe&gt;");
    expect(sanitized.nested.comment).toBe("Hello &amp; Goodbye");
    expect(sanitized.tags[0]).toBe("&lt;b&gt;tag1&lt;&#x2F;b&gt;");
    expect(sanitized.tags[1]).toBe(123);
  });

  it("identifies binary and FormData payloads correctly", () => {
    const formData = new FormData();
    const blob = new Blob(["hello"], { type: "text/plain" });
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    const buffer = new ArrayBuffer(8);
    const params = new URLSearchParams("key=value");

    expect(isBinaryOrFormData(formData)).toBe(true);
    expect(isBinaryOrFormData(blob)).toBe(true);
    expect(isBinaryOrFormData(file)).toBe(true);
    expect(isBinaryOrFormData(buffer)).toBe(true);
    expect(isBinaryOrFormData(params)).toBe(true);
    expect(isBinaryOrFormData({ name: "plain object" })).toBe(false);
  });

  it("preserves FormData objects without converting them to empty objects", () => {
    const formData = new FormData();
    formData.append("username", "john_doe");
    formData.append("avatar", new Blob(["avatar_binary"], { type: "image/png" }));

    const result = sanitizeObject(formData);
    expect(result).toBe(formData);
    expect(result.get("username")).toBe("john_doe");
  });

  it("preserves File objects inside plain objects", () => {
    const file = new File(["dummy content"], "doc.pdf", { type: "application/pdf" });
    const payload = {
      title: "<Doc Title>",
      file: file,
    };

    const sanitized = sanitizeObject(payload);
    expect(sanitized.title).toBe("&lt;Doc Title&gt;");
    expect(sanitized.file).toBe(file);
    expect(sanitized.file.name).toBe("doc.pdf");
  });
});
