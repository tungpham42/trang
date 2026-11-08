import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Empty,
  Progress,
  Result,
  Space,
  Spin,
  Typography,
} from "antd";
import { useAuth } from "../contexts/AuthContext";
import { loadStudyQueue, reviewCard } from "../lib/db";
import { formatInterval, schedule } from "../lib/srs";
import type { Grade } from "../lib/srs";
import type { Card as FlashCard } from "../lib/types";

const GRADES: { grade: Grade; label: string; key: string; danger?: boolean }[] =
  [
    { grade: 0, label: "Again", key: "1", danger: true },
    { grade: 1, label: "Hard", key: "2" },
    { grade: 2, label: "Good", key: "3" },
    { grade: 3, label: "Easy", key: "4" },
  ];

export default function Study() {
  const { lectureId } = useParams<{ lectureId?: string }>();
  const [params] = useSearchParams();
  const cram = params.get("all") === "1";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<FlashCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setQueue(null);
    setReviewed(0);
    setFlipped(false);
    setError(null);
    loadStudyQueue(user.uid, lectureId, cram)
      .then((items) => {
        if (cancelled) return;
        setQueue(items);
        setTotal(items.length);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load your cards. Check your connection and try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user, lectureId, cram]);

  const current = queue?.[0];

  const grade = useCallback(
    (g: Grade) => {
      if (!queue?.length || !flipped) return;
      const card = queue[0];
      const result = schedule(card, g);
      // In "review all" mode we practise without changing the schedule.
      if (!cram)
        reviewCard(card.id, result).catch(() =>
          setError("A review could not be saved. Check your connection."),
        );
      const rest = queue.slice(1);
      setQueue(
        g === 0
          ? [
              ...rest,
              {
                ...card,
                ease: result.ease,
                interval: result.interval,
                reps: result.reps,
              },
            ]
          : rest,
      );
      if (g !== 0) setReviewed((n) => n + 1);
      setFlipped(false);
    },
    [queue, flipped, cram],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        grade((Number(e.key) - 1) as Grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade]);

  const back = () => navigate(lectureId ? `/lectures/${lectureId}` : "/");

  if (error && !queue) return <Alert type="error" showIcon message={error} />;
  if (!queue) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <Spin />
      </div>
    );
  }

  if (total === 0) {
    return (
      <Card bordered={false}>
        <Empty
          description={
            cram
              ? "There are no cards here yet."
              : "Nothing is due right now. Nice work!"
          }
        >
          <Space wrap>
            {!cram && (
              <Button
                onClick={() =>
                  navigate(
                    `${lectureId ? `/study/${lectureId}` : "/study"}?all=1`,
                  )
                }
              >
                Review all cards anyway
              </Button>
            )}
            <Button type="primary" onClick={back}>
              Back
            </Button>
          </Space>
        </Empty>
      </Card>
    );
  }

  if (!current) {
    return (
      <Result
        status="success"
        title="Session complete"
        subTitle={`You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}.`}
        extra={
          <Button type="primary" onClick={back}>
            Done
          </Button>
        }
      />
    );
  }

  return (
    <Space
      direction="vertical"
      size={16}
      style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}
    >
      {error && (
        <Alert
          type="warning"
          showIcon
          message={error}
          closable
          onClose={() => setError(null)}
        />
      )}
      <div>
        <Progress
          percent={Math.round((reviewed / total) * 100)}
          showInfo={false}
        />
        <Typography.Text type="secondary">
          {reviewed} of {total} done
          {cram ? " · practice mode (schedule not changed)" : ""}
        </Typography.Text>
      </div>

      <div
        className={`flip${flipped ? " flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={
          flipped
            ? "Showing the answer. Press space to see the question."
            : "Press space to show the answer."
        }
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flip-inner">
          <div className="flip-face">{current.front}</div>
          <div className="flip-face flip-back">{current.back}</div>
        </div>
      </div>

      {!flipped ? (
        <Button
          type="primary"
          size="large"
          block
          onClick={() => setFlipped(true)}
        >
          Show answer (space)
        </Button>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {GRADES.map((g) => (
            <Button
              key={g.grade}
              size="large"
              danger={g.danger}
              type={g.grade === 2 ? "primary" : "default"}
              onClick={() => grade(g.grade)}
              style={{
                height: "auto",
                padding: "8px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span>
                {g.label} ({g.key})
              </span>
              {!cram && (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  {formatInterval(
                    schedule(current, g.grade).dueMs - Date.now(),
                  )}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
    </Space>
  );
}
