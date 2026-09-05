export const ADMIN_SESSION_COOKIE = "n-sei-admin-session";

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "changeme123";
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getExpectedSessionToken(): Promise<string> {
  return sha256Hex(`n-sei-admin:${getAdminPassword()}`);
}

export function checkPassword(password: string): boolean {
  return password === getAdminPassword();
}

export async function isValidSessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  return token === (await getExpectedSessionToken());
}
