import fs from "node:fs";
import path from "node:path";
import { APP_BASE_URL, ROLE_STORAGE, STORAGE_DIR, type RoleKey } from "./constants";
import type { RoleSession } from "./api";

export function writeRoleStorage(role: RoleKey, session: RoleSession): void {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const origin = new URL(APP_BASE_URL).origin;
  fs.writeFileSync(
    ROLE_STORAGE[role],
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: "sheet_sherlock_access_token", value: session.tokens.access_token },
              { name: "sheet_sherlock_refresh_token", value: session.tokens.refresh_token },
              { name: "sheet_sherlock_user", value: JSON.stringify(session.user) },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
}

export function storageFor(role: RoleKey): string {
  return path.resolve(ROLE_STORAGE[role]);
}

export function readStoredUser(role: RoleKey): RoleSession["user"] {
  const storage = JSON.parse(fs.readFileSync(storageFor(role), "utf8")) as {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
  const userItem = storage.origins[0]?.localStorage.find((item) => item.name === "sheet_sherlock_user");
  if (!userItem) {
    throw new Error(`Missing stored user for ${role}`);
  }
  return JSON.parse(userItem.value) as RoleSession["user"];
}
