import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { App as AntApp, Button, Popconfirm, Skeleton, Tooltip } from "antd";
import {
  AudioOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FireOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  ReadOutlined,
  SmileOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { useDueCount } from "../hooks/useDueCount";
import { deleteLecture, subscribeLectures } from "../lib/db";
import type { Lecture } from "../lib/types";

const STATUS: Record<Lecture["status"], { cls: string; text: string; icon: JSX.Element }> = {
  processing: { cls: "processing", text: "Working on it", icon: <LoadingOutlined /> },
  ready: { cls: "ready", text: "Ready to study", icon: <CheckCircleOutlined /> },
  error: { cls: "error", text: "Needs a look", icon: <ExclamationCircleOutlined /> },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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

  const totalCards = (lectures ?? []).reduce((sum, l) => sum + (l.cardCount || 0), 0);
  const dueLabel = due >= 100 ? "100+" : String(due);
  const firstName = (user?.displayName || user?.email || "").split(/[ @]/)[0];

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="hero">
        <h1>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}{" "}
          <SmileOutlined className="hero-icon" />
        </h1>
        <p>
          {due > 0
            ? `You have ${dueLabel} flashcard${due === 1 ? "" : "s"} ready. A few minutes now will help it stick.`
            : "You're all caught up. Add a lecture to start a new study set."}
        </p>
        <div className="hero-actions">
          <Button
            type="primary"
            size="large"
            icon={due > 0 ? <ThunderboltOutlined /> : <PlusOutlined />}
            onClick={() => navigate(due > 0 ? "/study" : "/new")}
          >
            {due > 0 ? "Start reviewing" : "New study set"}
          </Button>
        </div>
      </section>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="stat">
          <div className="stat-icon coral"><FireOutlined /></div>
          <div>
            <div className="stat-label">Due today</div>
            <div className="stat-value">{dueLabel}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon violet"><CreditCardOutlined /></div>
          <div>
            <div className="stat-label">Flashcards</div>
            <div className="stat-value">{totalCards}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon mint"><BookOutlined /></div>
          <div>
            <div className="stat-label">Lectures</div>
            <div className="stat-value">{lectures?.length ?? 0}</div>
          </div>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h2>Your library</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button icon={<AudioOutlined />} onClick={() => navigate("/transcribe")}>
              Live transcript
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/new")}>
              New lecture
            </Button>
          </div>
        </div>

        {lectures === null ? (
          <div className="lecture-grid">
            {[0, 1, 2].map((i) => (
              <div className="lecture-card" key={i}>
                <Skeleton active paragraph={{ rows: 2 }} title={{ width: "70%" }} />
              </div>
            ))}
          </div>
        ) : lectures.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ReadOutlined />
            </div>
            <h3>Your library is waiting</h3>
            <p>Upload a PDF or PowerPoint, or record a live transcript, and we'll do the rest.</p>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate("/new")}>
              Create my first study set
            </Button>
          </div>
        ) : (
          <div className="lecture-grid">
            {lectures.map((l) => {
              const s = STATUS[l.status];
              const isAudio = l.sourceType === "transcript";
              const SourceIcon = isAudio ? AudioOutlined : FileTextOutlined;
              return (
                <article className="lecture-card" key={l.id}>
                  <Link to={`/lectures/${l.id}`} className="lecture-link" aria-label={`Open ${l.title}`} />
                  <div className="lecture-card-top">
                    <span className={`lecture-icon ${isAudio ? "audio" : l.sourceType === "pdf" || l.sourceType === "pptx" ? "pdf" : ""}`}>
                      <SourceIcon />
                    </span>
                    <span style={{ position: "relative", zIndex: 1 }}>
                      <Popconfirm
                        title="Delete this lecture and its flashcards?"
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove(l)}
                      >
                        <Tooltip title="Delete">
                          <Button type="text" shape="circle" danger icon={<DeleteOutlined />} aria-label="Delete lecture" />
                        </Tooltip>
                      </Popconfirm>
                    </span>
                  </div>

                  <div className="lecture-title">{l.title}</div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className={`pill ${s.cls}`}>
                      {s.icon}
                      {l.status === "processing" && l.progress ? `${l.progress}%` : s.text}
                    </span>
                  </div>

                  <div className="lecture-meta">
                    <span><CreditCardOutlined /> {l.cardCount} cards</span>
                    <span><CalendarOutlined /> {dayjs(l.createdAt.toMillis()).format("MMM D, YYYY")}</span>
                    <span><ClockCircleOutlined /> {l.sourceType.toUpperCase()}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
