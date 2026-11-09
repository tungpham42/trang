import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { App as AntApp, Button, Divider, Form, Input, Tabs } from "antd";
import {
  CheckCircleFilled,
  GoogleOutlined,
  LockOutlined,
  MailOutlined,
  ReadOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";

function friendlyError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Hmm, that email or password doesn't match. Try again?";
    case "auth/email-already-in-use":
      return "You already have an account with this email. Try signing in.";
    case "auth/weak-password":
      return "Pick a password with at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "No problem, sign-in was cancelled.";
    case "auth/too-many-requests":
      return "Lots of attempts! Take a short break and try again in a few minutes.";
    case "auth/operation-not-allowed":
      return "Guest mode isn't available right now.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const PERKS = [
  "Turn PDFs and slides into clear study notes",
  "Auto-made flashcards that cover every section",
  "Gentle reminders when it's time to review",
];

export default function Login() {
  const {
    user,
    loading,
    signInWithGoogle,
    signInAsGuest,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();
  const { message } = AntApp.useApp();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (!loading && user) return <Navigate to={from} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      message.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const signIn = (
    <Form
      layout="vertical"
      requiredMark={false}
      onFinish={(v: { email: string; password: string }) =>
        run(() => signInWithEmail(v.email, v.password))
      }
    >
      <Form.Item
        name="email"
        rules={[
          { required: true, type: "email", message: "Enter a valid email" },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="Email"
          autoComplete="email"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: "Enter your password" }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Password"
          autoComplete="current-password"
          size="large"
        />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={busy}
      >
        Sign in
      </Button>
    </Form>
  );

  const signUp = (
    <Form
      layout="vertical"
      requiredMark={false}
      onFinish={(v: { name: string; email: string; password: string }) =>
        run(() => signUpWithEmail(v.name ?? "", v.email, v.password))
      }
    >
      <Form.Item name="name">
        <Input
          prefix={<UserOutlined />}
          placeholder="Name (optional)"
          autoComplete="name"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="email"
        rules={[
          { required: true, type: "email", message: "Enter a valid email" },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="Email"
          autoComplete="email"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, min: 6, message: "At least 6 characters" }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Password (6+ characters)"
          autoComplete="new-password"
          size="large"
        />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={busy}
      >
        Create my account
      </Button>
    </Form>
  );

  return (
    <div className="auth">
      <section className="auth-hero">
        <span
          className="brand-mark"
          style={{ background: "rgba(255,255,255,.22)", boxShadow: "none" }}
        >
          <ReadOutlined />
        </span>
        <h1>
          Learn faster,
          <br />
          remember longer.
        </h1>
        <p>
          Turn long lectures and slides into study notes and flashcards, then
          review at just the right moments.
        </p>
        <ul className="auth-steps">
          {PERKS.map((p) => (
            <li key={p}>
              <CheckCircleFilled style={{ fontSize: 18 }} />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>
            Welcome <SmileOutlined className="hero-icon-sm" />
          </h2>
          <p className="auth-sub">Sign in to pick up where you left off.</p>

          <Button
            icon={<GoogleOutlined />}
            size="large"
            block
            loading={busy}
            onClick={() => run(signInWithGoogle)}
          >
            Continue with Google
          </Button>
          <Divider plain style={{ color: "var(--muted)", fontSize: 13 }}>
            or use email
          </Divider>
          <Tabs
            centered
            items={[
              { key: "in", label: "Sign in", children: signIn },
              { key: "up", label: "Create account", children: signUp },
            ]}
          />
          <Divider plain style={{ color: "var(--muted)", fontSize: 13 }}>
            or
          </Divider>
          <Button
            type="text"
            icon={<UserOutlined />}
            size="large"
            block
            loading={busy}
            onClick={() => run(signInAsGuest)}
          >
            Continue as guest
          </Button>
        </div>
      </section>
    </div>
  );
}
