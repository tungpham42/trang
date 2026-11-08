import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  List,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  AudioOutlined,
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { useDueCount } from "../hooks/useDueCount";
import { deleteLecture, subscribeLectures } from "../lib/db";
import type { Lecture } from "../lib/types";

const STATUS_TAG: Record<Lecture["status"], { color: string; text: string }> = {
  processing: { color: "processing", text: "Processing" },
  ready: { color: "success", text: "Ready" },
  error: { color: "error", text: "Needs attention" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const due = useDueCount(user?.uid);
  const [lectures, setLectures] = useState<Lecture[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeLectures(user.uid, setLectures);
  }, [user]);

  const totalCards = (lectures ?? []).reduce(
    (sum, l) => sum + (l.cardCount || 0),
    0,
  );

  const remove = async (l: Lecture) => {
    if (!user) return;
    try {
      await deleteLecture(user.uid, l.id);
      message.success("Deleted");
    } catch {
      message.error("Could not delete this lecture.");
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {due > 0 && (
        <Alert
          type="info"
          showIcon
          message={`${due >= 100 ? "100+" : due} flashcard${due === 1 ? " is" : "s are"} due`}
          description="A short review now helps it stick."
          action={
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => navigate("/study")}
            >
              Study now
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Card bordered={false}>
            <Statistic title="Due now" value={due >= 100 ? "100+" : due} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false}>
            <Statistic title="Flashcards" value={totalCards} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="Lectures" value={lectures?.length ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        bordered={false}
        title="Your lectures"
        extra={
          <Space wrap>
            <Button
              icon={<AudioOutlined />}
              onClick={() => navigate("/transcribe")}
            >
              Live transcript
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/new")}
            >
              New lecture
            </Button>
          </Space>
        }
      >
        <List
          loading={lectures === null}
          dataSource={lectures ?? []}
          locale={{
            emptyText: (
              <Empty description="Upload a PDF or PowerPoint, or record a live transcript, to get started.">
                <Button type="primary" onClick={() => navigate("/new")}>
                  Create your first study set
                </Button>
              </Empty>
            ),
          }}
          renderItem={(l) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="Delete this lecture and its flashcards?"
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(l)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Delete lecture"
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Link to={`/lectures/${l.id}`}>
                    <Typography.Text strong>{l.title}</Typography.Text>
                  </Link>
                }
                description={
                  <Space size={[8, 4]} wrap>
                    <Tag color={STATUS_TAG[l.status].color}>
                      {l.status === "processing" && l.progress
                        ? `${l.progress}%`
                        : STATUS_TAG[l.status].text}
                    </Tag>
                    <span>{l.sourceType.toUpperCase()}</span>
                    <span>{l.cardCount} cards</span>
                    <span>
                      {dayjs(l.createdAt.toMillis()).format("MMM D, YYYY")}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
