const rawApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

// The rest of the frontend calls expect `API_BASE_URL` to already include `/api`.
const API_BASE_URL = rawApiBase
  ? rawApiBase.endsWith("/api")
    ? rawApiBase
    : `${rawApiBase}/api`
  : "";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_BASE_URL is not configured. Please set it in your environment (production requires it).",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Something went wrong. Please try again.");
  }

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await response.json()) as { detail?: string };
      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Keep generic fallback message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

type UploadOptions = {
  body: FormData;
  token?: string;
};

export async function apiUpload<T>(
  path: string,
  { body, token }: UploadOptions,
  { method = "POST" }: { method?: "POST" | "PUT" } = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_BASE_URL is not configured. Please set it in your environment (production requires it).",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
  } catch {
    throw new ApiError("Something went wrong. Please try again.");
  }

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await response.json()) as { detail?: string };
      if (data?.detail) message = data.detail;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
