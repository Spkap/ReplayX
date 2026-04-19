import type { AccessToken } from "../types.js";

export const requireSession = (token: AccessToken, now: number): void => {
  if (token.expiresAt <= now) {
    throw new Error("SessionRefreshError: issued access token expires before downstream validation window");
  }
};
