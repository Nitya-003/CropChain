describe("Happy Path Login Flow", () => {
  it("loads app and shows login option", () => {
    cy.visit("/");
    cy.contains("Login");
  });
});
