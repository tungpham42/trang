import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Progress,
  Result,
  Space,
  Spin,
  Steps,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import {
  addCards,
  deleteCard,
  deleteLecture,
  subscribeCards,
  subscribeLecture,
  updateCardText,
  updateLecture,
} from "../lib/db";
import { downloadText, safeFilename } from "../lib/download";
import { regenerateCards } from "../lib/pipeline";
import type { Card as FlashCard, Lecture } from "../lib/types";

const STAGES = ["summarizing", "merging", "cards"] as const;
const STALLED_AFTER_MS = 10 * 60_000;

interface CardForm {
  front: string;
  back: string;
}

export default function LecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined); // undefined = loading
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [editing, setEditing] = useState<{ card?: FlashCard } | null>(null);
  const [form] = Form.useForm<CardForm>();

  useEffect(() => {
    if (!lectureId) return;
    return subscribeLecture(lectureId, setLecture);
  }, [lectureId]);

  useEffect(() => {
    if (!user || !lectureId) return;
    return subscribeCards(user.uid, lectureId, setCards);
  }, [user, lectureId]);

  if (lecture === undefined) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <Spin />
      </div>
    );
  }
  if (lecture === null || !user || !lectureId) {
    return (
      <Result
        status="404"
        title="Lecture not found"
        extra={<Button onClick={() => navigate("/")}>Back to library</Button>}
      />
    );
  }

  const stalled =
    lecture.status === "processing" &&
    Date.now() - lecture.updatedAt.toMillis() > STALLED_AFTER_MS;
  const stageIndex = Math.max(
    0,
    STAGES.indexOf(lecture.stage as (typeof STAGES)[number]),
  );

  const retryCards = () =>
    void regenerateCards({
      uid: user.uid,
      lectureId,
      summary: lecture.summary,
      language: lecture.language,
      density: lecture.density,
    });

  const saveCard = async (values: CardForm) => {
    try {
      if (editing?.card) {
        await updateCardText(editing.card.id, values);
      } else {
        await addCards(user.uid, lectureId, [values]);
        await updateLecture(lectureId, { cardCount: cards.length + 1 });
      }
      setEditing(null);
    } catch {
      message.error("Could not save the card.");
    }
  };

  const removeCard = async (card: FlashCard) => {
    try {
      await deleteCard(card.id);
      await updateLecture(lectureId, {
        cardCount: Math.max(0, cards.length - 1),
      });
    } catch {
      message.error("Could not delete the card.");
    }
  };

  const exportAnki = () => {
    const clean = (s: string) =>
      s.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
    const body = cards
      .map((c) => `${clean(c.front)}\t${clean(c.back)}`)
      .join("\n");
    downloadText(
      `${safeFilename(lecture.title)}-flashcards.txt`,
      body,
      "text/tab-separated-values;charset=utf-8",
    );
  };

  const summaryTab = lecture.summary ? (
    <Card bordered={false}>
      <div className="md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {lecture.summary}
        </ReactMarkdown>
      </div>
    </Card>
  ) : (
    <Empty description="The summary will appear here." />
  );

  const cardsTab = (
    <Card
      bordered={false}
      extra={
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setEditing({})}>
            Add card
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={exportAnki}
            disabled={!cards.length}
          >
            Export for Anki
          </Button>
          <Popconfirm
            title="Replace all cards with newly generated ones?"
            description="Your edits to these cards will be lost."
            okText="Regenerate"
            onConfirm={retryCards}
            disabled={!lecture.summary || lecture.status === "processing"}
          >
            <Button
              icon={<ReloadOutlined />}
              disabled={!lecture.summary || lecture.status === "processing"}
            >
              Regenerate
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <List
        dataSource={cards}
        locale={{ emptyText: <Empty description="No flashcards yet." /> }}
        pagination={cards.length > 20 ? { pageSize: 20, size: "small" } : false}
        renderItem={(c) => (
          <List.Item
            actions={[
              <Button
                key="e"
                type="text"
                icon={<EditOutlined />}
                aria-label="Edit card"
                onClick={() => setEditing({ card: c })}
              />,
              <Popconfirm
                key="d"
                title="Delete this card?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => removeCard(c)}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Delete card"
                />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={<span style={{ whiteSpace: "pre-wrap" }}>{c.front}</span>}
              description={
                <span style={{ whiteSpace: "pre-wrap" }}>{c.back}</span>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {lecture.title}
          </Typography.Title>
          <Space size={[8, 4]} wrap style={{ marginTop: 6 }}>
            <Tag>{lecture.sourceType.toUpperCase()}</Tag>
            {lecture.sourceName && (
              <Typography.Text type="secondary">
                {lecture.sourceName}
              </Typography.Text>
            )}
            <Typography.Text type="secondary">
              {cards.length} cards
            </Typography.Text>
          </Space>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            disabled={!cards.length}
            onClick={() => navigate(`/study/${lectureId}`)}
          >
            Study due cards
          </Button>
          <Button
            disabled={!cards.length}
            onClick={() => navigate(`/study/${lectureId}?all=1`)}
          >
            Review all
          </Button>
          <Button
            icon={<DownloadOutlined />}
            disabled={!lecture.summary}
            onClick={() =>
              downloadText(
                `${safeFilename(lecture.title)}-summary.md`,
                lecture.summary,
                "text/markdown;charset=utf-8",
              )
            }
          >
            Summary
          </Button>
          <Popconfirm
            title="Delete this lecture and its flashcards?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              await deleteLecture(user.uid, lectureId);
              navigate("/");
            }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete lecture"
            />
          </Popconfirm>
        </Space>
      </div>

      {lecture.status === "processing" && !stalled && (
        <Card bordered={false}>
          <Steps
            size="small"
            current={stageIndex}
            items={[
              { title: "Summarizing" },
              { title: "Combining notes" },
              { title: "Making flashcards" },
            ]}
            style={{ marginBottom: 16 }}
          />
          <Progress percent={lecture.progress ?? 0} status="active" />
          <Typography.Text type="secondary">
            {lecture.stageDetail ? `Step ${lecture.stageDetail}. ` : ""}Keep
            this tab open until it finishes.
          </Typography.Text>
        </Card>
      )}

      {(lecture.status === "error" || stalled) && (
        <Alert
          type="error"
          showIcon
          message={stalled ? "This looks stuck" : "Something went wrong"}
          description={
            stalled
              ? "Processing stopped (the tab may have been closed)."
              : lecture.error || "Processing failed."
          }
          action={
            lecture.summary ? (
              <Button
                size="small"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={retryCards}
              >
                Retry flashcards
              </Button>
            ) : (
              <Button size="small" onClick={() => navigate("/new")}>
                Start over
              </Button>
            )
          }
        />
      )}

      <Tabs
        items={[
          { key: "summary", label: "Summary", children: summaryTab },
          {
            key: "cards",
            label: `Flashcards (${cards.length})`,
            children: cardsTab,
          },
        ]}
      />

      <Modal
        open={!!editing}
        title={editing?.card ? "Edit card" : "Add card"}
        okText="Save"
        onOk={() => form.submit()}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            front: editing?.card?.front ?? "",
            back: editing?.card?.back ?? "",
          }}
          onFinish={saveCard}
        >
          <Form.Item
            name="front"
            label="Front"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter the question",
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={400} />
          </Form.Item>
          <Form.Item
            name="back"
            label="Back"
            rules={[
              { required: true, whitespace: true, message: "Enter the answer" },
            ]}
          >
            <Input.TextArea rows={5} maxLength={1200} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
