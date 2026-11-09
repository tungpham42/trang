import { Avatar, Badge, Button, Dropdown, Menu } from "antd";
import type { DropdownProps, MenuProps } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AudioOutlined,
  BookOutlined,
  BulbOutlined,
  LogoutOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useDueCount } from "../hooks/useDueCount";
import { useReminders } from "../hooks/useReminders";
import { useUserSettings } from "../hooks/useUserSettings";

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="brand"
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      role="link"
      tabIndex={0}
    >
      <span className="brand-mark">
        <BulbOutlined />
      </span>
      <span className="brand-name">
        Learning <span>Master</span> Ez
      </span>
    </div>
  );
}

function UserMenu({
  name,
  initial,
  onLogout,
  placement,
}: {
  name: string;
  initial: string;
  onLogout: () => void;
  placement: DropdownProps["placement"];
}) {
  return (
    <Dropdown
      placement={placement}
      trigger={["click"]}
      menu={{
        items: [
          {
            key: "out",
            icon: <LogoutOutlined />,
            label: "Sign out",
            onClick: onLogout,
          },
        ],
      }}
    >
      <Button type="text" shape="round" className="user-btn">
        <Avatar size={30} style={{ background: "var(--grad)", fontWeight: 700 }}>
          {initial}
        </Avatar>
        <span className="user-name">{name}</span>
      </Button>
    </Dropdown>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const due = useDueCount(user?.uid);
  const settings = useUserSettings(user?.uid);
  useReminders(due, settings);

  const root = pathname.split("/")[1];
  const selected = root === "" || root === "lectures" ? "/" : `/${root}`;

  const items: MenuProps["items"] = [
    { key: "/", icon: <BookOutlined />, label: "Library", title: "Library" },
    { key: "/new", icon: <PlusOutlined />, label: "New", title: "New" },
    {
      key: "/study",
      icon: (
        <Badge count={due} overflowCount={99} size="small" offset={[4, -4]}>
          <ThunderboltOutlined />
        </Badge>
      ),
      label: "Study",
      title: "Study",
    },
    {
      key: "/transcribe",
      icon: <AudioOutlined />,
      label: "Transcribe",
      title: "Transcribe",
    },
    {
      key: "/settings",
      icon: <SettingOutlined />,
      label: "Settings",
      title: "Settings",
    },
  ];

  const name = user?.displayName || user?.email || "You";
  const initial = name.charAt(0).toUpperCase();
  const goHome = () => navigate("/");
  const onLogout = () => void logout();
  const onSelect: MenuProps["onClick"] = ({ key }) => navigate(key);

  return (
    <div className="app-shell">
      {/* Desktop / tablet: left sidebar (icon rail on tablets) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand onClick={goHome} />
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={items}
          onClick={onSelect}
        />

        <div className="sidebar-footer">
          <UserMenu
            name={name}
            initial={initial}
            onLogout={onLogout}
            placement="topLeft"
          />
        </div>
      </aside>

      {/* Phones: slim top bar ... */}
      <header className="mobilebar">
        <Brand onClick={goHome} />
        <UserMenu
          name={name}
          initial={initial}
          onLogout={onLogout}
          placement="bottomRight"
        />
      </header>

      <main className="content">
        <div className="page">
          <Outlet />
        </div>
      </main>

      {/* ... plus floating bottom nav */}
      <nav className="bottomnav" aria-label="Main navigation">
        <Menu
          mode="horizontal"
          selectedKeys={[selected]}
          items={items}
          onClick={onSelect}
        />
      </nav>
    </div>
  );
}
