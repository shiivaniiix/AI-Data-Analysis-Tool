import { STORAGE_KEYS } from "@/constants/storage-keys";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }
  return localStorage;
}

export function getToken(): string | null {
  return getStorage()?.getItem(STORAGE_KEYS.TOKEN) ?? null;
}

export function setToken(token: string): void {
  getStorage()?.setItem(STORAGE_KEYS.TOKEN, token);
}

export function removeToken(): void {
  getStorage()?.removeItem(STORAGE_KEYS.TOKEN);
}

export function getUsername(): string | null {
  return getStorage()?.getItem(STORAGE_KEYS.USERNAME) ?? null;
}

export function getNewChatId(): string | null {
  return getStorage()?.getItem(STORAGE_KEYS.NEW_CHAT_ID) ?? null;
}

export function removeNewChatId(): void {
  getStorage()?.removeItem(STORAGE_KEYS.NEW_CHAT_ID);
}

/** Persist session after login — same keys as before. */
export function setSessionFromLogin(data: {
  access_token: string;
  email: string;
  username: string;
  new_chat_id: string;
}): void {
  const s = getStorage();
  if (!s) return;
  s.setItem(STORAGE_KEYS.TOKEN, data.access_token);
  s.setItem(STORAGE_KEYS.USER_EMAIL, data.email);
  s.setItem(STORAGE_KEYS.USERNAME, data.username);
  s.setItem(STORAGE_KEYS.NEW_CHAT_ID, data.new_chat_id);
}

/** Clear auth-related keys (logout / delete account). */
export function clearSession(): void {
  const s = getStorage();
  if (!s) return;
  s.removeItem(STORAGE_KEYS.TOKEN);
  s.removeItem(STORAGE_KEYS.USER_EMAIL);
  s.removeItem(STORAGE_KEYS.USERNAME);
}
