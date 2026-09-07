import { cookies } from "next/headers";

function cookieName(projectId: number): string {
  return `justo-m-${projectId}`;
}

export async function getCurrentMemberId(
  projectId: number,
): Promise<number | null> {
  const store = await cookies();
  const value = store.get(cookieName(projectId))?.value;
  const id = value ? Number(value) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function setCurrentMember(
  projectId: number,
  memberId: number,
): Promise<void> {
  const store = await cookies();
  store.set(cookieName(projectId), String(memberId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/p/${projectId}`,
    maxAge: 60 * 60 * 24 * 365,
  });
}
