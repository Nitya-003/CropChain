/**
 * Unit tests for the RBAC permissions constant.
 *
 * These tests act as a regression guard to ensure every permission string
 * follows the expected 'resource:action' format and that no typos (such as
 * spaces instead of colons) are silently introduced in future edits.
 */

const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
} = require("../constants/permissions");

describe("PERMISSIONS constants", () => {
  const entries = Object.entries(PERMISSIONS);

  it("defines at least one permission", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)(
    'permission %s uses "resource:action" format (colon separator, no spaces)',
    (key, value) => {
      // Must contain exactly one colon
      expect(value).toMatch(/^[a-z_]+:[a-z_]+$/);
      // Must not contain any space
      expect(value).not.toContain(" ");
    },
  );

  it('USER_DELETE is "user:delete" (regression guard for #347)', () => {
    expect(PERMISSIONS.USER_DELETE).toBe("user:delete");
  });
});

describe("ROLE_PERMISSIONS integrity", () => {
  const validPermissionValues = new Set(Object.values(PERMISSIONS));

  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    it(`all permissions granted to "${role}" exist in PERMISSIONS`, () => {
      perms.forEach((perm) => {
        expect(validPermissionValues.has(perm)).toBe(true);
      });
    });
  });

  it("ADMIN role includes USER_DELETE", () => {
    expect(ROLE_PERMISSIONS[ROLES.ADMIN]).toContain(PERMISSIONS.USER_DELETE);
  });

  it("SUPER_ADMIN role includes USER_DELETE", () => {
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]).toContain(
      PERMISSIONS.USER_DELETE,
    );
  });
});
