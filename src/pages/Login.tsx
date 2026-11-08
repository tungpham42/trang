import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  App as AntApp,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Tabs,
  Typography,
} from "antd";
import {
  GoogleOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";

function friendlyError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    default:
      return "Could not sign in. Please try again.";
  }
}

export default function Login() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth();
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
          placeholder="Password"
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
        Create account
      </Button>
    </Form>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 400 }} bordered={false}>
        <Typography.Title level={3} style={{ marginTop: 0, color: "#4f46e5" }}>
          Learning Master Ez
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Turn lectures and slides into summaries and flashcards, then learn a
          little every day.
        </Typography.Paragraph>
        <Button
          icon={<GoogleOutlined />}
          size="large"
          block
          loading={busy}
          onClick={() => run(signInWithGoogle)}
        >
          Continue with Google
        </Button>
        <Divider plain>or</Divider>
        <Tabs
          centered
          items={[
            { key: "in", label: "Sign in", children: signIn },
            { key: "up", label: "Create account", children: signUp },
          ]}
        />
      </Card>
    </div>
  );
}
