import { useState } from "react";
import {
  Alert,
  App as AntApp,
  Card,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useUserSettings } from "../hooks/useUserSettings";
import { saveSettings } from "../lib/db";
import {
  disablePush,
  enablePush,
  isPushEnabledOnDevice,
} from "../lib/reminders";
import type { UserSettings } from "../lib/types";

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, "0")}:00`,
}));
const INTERVALS = [1, 2, 4, 8, 24].map((h) => ({
  value: h,
  label: h === 24 ? "Once a day" : `Every ${h} hour${h === 1 ? "" : "s"}`,
}));

export default function Settings() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const settings = useUserSettings(user?.uid);
  const [pushOn, setPushOn] = useState(isPushEnabledOnDevice());
  const [busy, setBusy] = useState(false);

  if (!user || !settings) return null;

  const update = async (patch: Partial<UserSettings>) => {
    try {
      // Keep the time zone fresh so quiet hours stay correct (also across daylight saving changes).
      await saveSettings(user.uid, {
        ...patch,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      });
    } catch {
      message.error("Could not save your settings.");
    }
  };

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        await enablePush(user.uid);
        await update({ reminderEnabled: true });
        setPushOn(true);
        message.success("Notifications are on for this device.");
      } else {
        await disablePush(user.uid);
        setPushOn(false);
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Could not change notifications.",
      );
    } finally {
      setBusy(false);
    }
  };

  const denied =
    typeof Notification !== "undefined" && Notification.permission === "denied";

  return (
    <Space
      direction="vertical"
      size={16}
      style={{ width: "100%", maxWidth: 640 }}
    >
      <Typography.Title level={3} style={{ margin: 0 }}>
        Settings
      </Typography.Title>

      <Card bordered={false} title="Study reminders">
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <Space>
            <Switch
              checked={settings.reminderEnabled}
              onChange={(v) => update({ reminderEnabled: v })}
              aria-label="Enable study reminders"
            />
            <span>Remind me to review when flashcards are due</span>
          </Space>

          <Space wrap>
            <span>Remind me</span>
            <Select
              value={settings.reminderEveryHours}
              options={INTERVALS}
              onChange={(v) => update({ reminderEveryHours: v })}
              disabled={!settings.reminderEnabled}
              style={{ width: 160 }}
            />
          </Space>

          <Space wrap>
            <span>Quiet hours</span>
            <Select
              value={settings.quietStartHour}
              options={HOURS}
              onChange={(v) => update({ quietStartHour: v })}
              disabled={!settings.reminderEnabled}
              style={{ width: 100 }}
            />
            <span>to</span>
            <Select
              value={settings.quietEndHour}
              options={HOURS}
              onChange={(v) => update({ quietEndHour: v })}
              disabled={!settings.reminderEnabled}
              style={{ width: 100 }}
            />
          </Space>
        </Space>
      </Card>

      <Card bordered={false} title="Push notifications on this device">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            With push on, reminders reach you even when Learning Master Ez is
            closed. Without it, you get a reminder inside the app while it is
            open.
          </Typography.Text>
          {denied && (
            <Alert
              type="warning"
              showIcon
              message="Notifications are blocked for this site. Allow them in your browser’s site settings, then try again."
            />
          )}
          <Space>
            <Switch
              checked={pushOn}
              loading={busy}
              onChange={togglePush}
              aria-label="Push notifications on this device"
            />
            <span>
              <BellOutlined /> {pushOn ? "On for this device" : "Off"}
            </span>
          </Space>
          {settings.fcmTokens.length > 0 && (
            <Typography.Text type="secondary">
              {settings.fcmTokens.length} device
              {settings.fcmTokens.length === 1 ? "" : "s"} registered.
            </Typography.Text>
          )}
        </Space>
      </Card>
    </Space>
  );
}
