import { Badge, Button, Dropdown, Layout, Menu, Avatar } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AudioOutlined,
  BookOutlined,
  LogoutOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  BulbOutlined,
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
      icon: (
        <Badge count={due} overflowCount={99} size="small" offset={[4, -4]}>
          <ThunderboltOutlined />
        </Badge>
      ),
      label: "Study",
    },
    { key: "/transcribe", icon: <AudioOutlined />, label: "Transcribe" },
    { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
  ];

  const name = user?.displayName || user?.email || "You";
  const initial = name.charAt(0).toUpperCase();

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <Header className="topbar" style={{ padding: undefined, lineHeight: undefined }}>
        <div className="brand" onClick={() => navigate("/")} role="link">
          <span className="brand-mark">
            <BulbOutlined />
          </span>
          <span className="brand-name hide-sm">
            Learning <span>Master</span> Ez
          </span>
        </div>

        <Menu
          mode="horizontal"
          selectedKeys={[selected]}
          items={items}
          onClick={({ key }) => navigate(key)}
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
          <Button type="text" shape="round" className="hide-sm-btn" style={{ height: 40, padding: "0 6px 0 4px" }}>
            <Avatar size={30} style={{ background: "var(--grad)", fontWeight: 700 }}>
              {initial}
            </Avatar>
            <span className="hide-sm" style={{ marginLeft: 6, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </span>
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
