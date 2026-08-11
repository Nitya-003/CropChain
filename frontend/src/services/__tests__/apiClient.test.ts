import { apiClient } from "../apiClient";
import { tokenService } from "../token.service";

describe("apiClient response interceptor", () => {
  beforeEach(() => {
    tokenService.clearAccessToken();
    localStorage.clear();
  });

  it("clears token, removes user from localStorage, and dispatches auth:logout event on refresh failure", async () => {
    tokenService.setAccessToken("expired-token");
    localStorage.setItem("user", JSON.stringify({ id: "1", name: "Test User" }));

    const logoutListener = vi.fn();
    window.addEventListener("auth:logout", logoutListener);

    // Mock apiClient.post for /auth/refresh failure
    const postSpy = vi.spyOn(apiClient, "post").mockRejectedValueOnce(new Error("Refresh token expired"));

    try {
      // Simulate 401 error response on an API call
      await apiClient.interceptors.response.handlers[0].rejected({
        response: { status: 401 },
        config: { url: "/profile", headers: {} },
      });
    } catch (err) {
      // Interceptor should reject the request
    }

    expect(tokenService.getAccessToken()).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(logoutListener).toHaveBeenCalled();

    window.removeEventListener("auth:logout", logoutListener);
    postSpy.mockRestore();
  });
});
