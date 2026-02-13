import { randomBytes } from "crypto";
import { cookies } from "next/headers";

const STATE_COOKIE_NAME = "oauth_state";
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function generateState(): Promise<string> {
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_EXPIRY_MS / 1000,
    path: "/",
  });

  return state;
}

export async function validateState(state: string): Promise<boolean> {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  // Clear the state cookie
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!storedState || storedState !== state) {
    return false;
  }

  return true;
}
