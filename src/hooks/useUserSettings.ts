import { useEffect, useState } from "react";
import { subscribeSettings } from "../lib/db";
import type { UserSettings } from "../lib/types";

export function useUserSettings(uid?: string): UserSettings | null {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    if (!uid) {
      setSettings(null);
      return;
    }
    return subscribeSettings(uid, setSettings);
  }, [uid]);

  return settings;
}
