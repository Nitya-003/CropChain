let accessToken: string | null = null;

export const tokenService = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null) {
    accessToken = token;
  },

  clearAccessToken() {
    accessToken = null;
  },
};
