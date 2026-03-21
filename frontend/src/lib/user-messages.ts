/** Short, human-friendly copy for common failures (frontend only). */
export const UserMessage = {
  network: "Something went wrong. Please try again.",
  upload: "Could not upload file. Try again.",
  loadChats: "Couldn't load chats. Try again.",
  loadMessages: "Couldn't load messages. Try again.",
  newChat: "Couldn't start a new chat. Try again.",
  deleteChat: "Couldn't delete this chat. Try again.",
  sendMessage: "Couldn't send your message. Try again.",
  share: "Couldn't create share link. Try again.",
  acceptShare: "Couldn't open this link. Try again.",
  export: "Couldn't download that file. Try again.",
  exportChart: "Couldn't save chart image. Try again.",
  insights: "Couldn't load insights. Try again.",
  refreshCharts: "Couldn't update charts. Try again.",
  signup: "Couldn't create your account. Try again.",
  verifyOtp: "That code didn't work. Check and try again.",
  resendOtp: "Couldn't resend code. Try again.",
  login: "Couldn't sign you in. Check details and try again.",
  deleteAccount: "Couldn't delete account. Try again.",
  pickFile: "Choose a CSV or Excel file first.",
  notLoggedIn: "Please sign in first.",
  needPassword: "Enter your password to confirm.",
  missingShareToken: "This link looks invalid.",
  needLoginForShare: "Please sign in to open this chat.",
} as const;

function mapTechnicalPhrase(msg: string): string | null {
  const lower = msg.trim().toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower === "load failed" ||
    lower.includes("network request failed")
  ) {
    return UserMessage.network;
  }
  if (lower === "request failed." || lower === "request failed") {
    return UserMessage.network;
  }
  if (lower.includes("next_public_api_base_url")) {
    return "Can't connect right now. Try again later.";
  }
  if (lower.includes("export failed") || lower === "export failed.") {
    return UserMessage.export;
  }
  return null;
}

/**
 * Turn errors into short UI copy. Known technical phrases become friendly;
 * otherwise uses the error message (e.g. API validation text) or fallback.
 */
export function userFacingError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message.trim()
      : typeof err === "string"
        ? err.trim()
        : "";
  if (!raw) return fallback;
  const mapped = mapTechnicalPhrase(raw);
  if (mapped) return mapped;
  return raw || fallback;
}
