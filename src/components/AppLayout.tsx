import { Badge, Button, Dropdown, Layout, Menu, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AudioOutlined,
  BookOutlined,
  LogoutOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useDueCount } from "../hooks/useDueCount";
import { useReminders } from "../hooks/useReminders";
import { useUserSettings } from "../hooks/useUserSettings";

const { Header, Content } = Layout;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const due = useDueCount(user?.uid);
  const settings = useUserSettings(user?.uid);
  useReminders(due, settings);

  const root = pathname.split("/")[1];
  const selected = root === "" || root === "lectures" ? "/" : `/${root}`;

  const items = [
    { key: "/", icon: <BookOutlined />, label: "Library" },
    { key: "/new", icon: <PlusOutlined />, label: "New" },
    {
      key: "/study",
      icon: <ThunderboltOutlined />,
      label: (
        <Badge count={due} overflowCount={99} size="small" offset={[10, -2]}>
          <span style={{ paddingRight: 2 }}>Study</span>
        </Badge>
      ),
    },
    { key: "/transcribe", icon: <AudioOutlined />, label: "Transcribe" },
    { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <Header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: "#fff",
          borderBottom: "1px solid #eceef5",
        }}
      >
        <Typography.Text
          strong
          style={{
            fontSize: 17,
            color: "#4f46e5",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onClick={() => navigate("/")}
        >
          Learning Master Ez
        </Typography.Text>
        <Menu
          mode="horizontal"
          selectedKeys={[selected]}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, borderBottom: "none" }}
        />
        <Dropdown
          menu={{
            items: [
              {
                key: "out",
                icon: <LogoutOutlined />,
                label: "Sign out",
                onClick: () => void logout(),
              },
            ],
          }}
          trigger={["click"]}
        >
          <Button type="text" icon={<UserOutlined />}>
            <span className="hide-sm">{user?.displayName || user?.email}</span>
          </Button>
        </Dropdown>
      </Header>
      <Content>
        <div className="page">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
