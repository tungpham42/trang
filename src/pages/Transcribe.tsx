import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import {
  AudioOutlined,
  BookOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PauseCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import type { Segment } from "../hooks/useSpeechRecognition";
import {
  createTranscript,
  deleteTranscript,
  subscribeTranscripts,
} from "../lib/db";
import { downloadText, formatDuration, safeFilename } from "../lib/download";
import type { Transcript } from "../lib/types";

const LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "vi-VN", label: "Vietnamese" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "zh-CN", label: "Chinese (Mandarin)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "id-ID", label: "Indonesian" },
  { value: "hi-IN", label: "Hindi" },
];

const DRAFT_KEY = "ll_transcript_draft";

function defaultLang(): string {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en-US";
  return (
    LANGS.find((l) => l.value.toLowerCase() === nav.toLowerCase())?.value ??
    LANGS.find((l) => l.value.startsWith(nav.split("-")[0]))?.value ??
    "en-US"
  );
}

function buildText(segments: Segment[], withTimes: boolean): string {
  return segments
    .map((s) => (withTimes ? `[${formatDuration(s.at)}] ${s.text}` : s.text))
    .join("\n");
}

export default function Transcribe() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const [lang, setLang] = useState(defaultLang);
  const [onDevice, setOnDevice] = useState(false);
  const [showTimes, setShowTimes] = useState(true);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<Transcript[] | null>(null);
  const [saving, setSaving] = useState(false);

  const speech = useSpeechRecognition({ lang, onDevice });
  const { segments, interim, listening, loadSegments } = speech;
  const boxRef = useRef<HTMLDivElement>(null);

  // Restore a draft left by a closed tab or crash.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { segments?: Segment[] };
      if (draft.segments?.length) {
        loadSegments(draft.segments);
        message.info("Restored your unsaved transcript.");
      }
    } catch {
      // ignore a corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a local draft so a long meeting is never lost.
  useEffect(() => {
    try {
      if (segments.length)
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ segments }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // storage unavailable
    }
  }, [segments]);

  useEffect(() => {
    if (!user) return;
    return subscribeTranscripts(user.uid, setSaved);
  }, [user]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [segments, interim]);

  useEffect(() => {
    if (!listening) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [listening]);

  const durationSec = segments.length ? segments[segments.length - 1].at : 0;
  const plainText = useMemo(() => buildText(segments, false), [segments]);
  const timedText = useMemo(() => buildText(segments, true), [segments]);
  const defaultTitle = () =>
    title.trim() || `Transcript ${dayjs().format("YYYY-MM-DD HH:mm")}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(showTimes ? timedText : plainText);
      message.success("Copied");
    } catch {
      message.error("Could not copy. Select the text and copy it manually.");
    }
  };

  const save = async () => {
    if (!user || !segments.length) return;
    setSaving(true);
    try {
      await createTranscript(user.uid, {
        title: defaultTitle(),
        text: timedText,
        lang,
        durationSec,
      });
      message.success("Saved to your account");
      speech.reset();
      setTitle("");
    } catch {
      message.error("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const makeStudySet = (text: string, name: string) =>
    navigate("/new", {
      state: {
        text: text.replace(/^\[[\d:]+\] /gm, ""),
        title: name,
        sourceType: "transcript",
      },
    });

  if (!speech.supported) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Live transcription is not supported in this browser"
        description="The Web Speech API is available in Chrome, Edge and Safari. Open this page in one of them."
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Live transcript
      </Typography.Title>

      <Card bordered={false}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            {listening ? (
              <Button
                danger
                type="primary"
                size="large"
                icon={<PauseCircleOutlined />}
                onClick={speech.stop}
              >
                Pause
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<AudioOutlined />}
                onClick={speech.start}
              >
                {segments.length ? "Resume" : "Start listening"}
              </Button>
            )}
            <Select
              value={lang}
              onChange={setLang}
              options={LANGS}
              style={{ minWidth: 190 }}
              aria-label="Spoken language"
            />
            <Typography.Text type="secondary">
              {listening
                ? `Listening · ${formatDuration(durationSec)}`
                : segments.length
                  ? `Paused · ${formatDuration(durationSec)}`
                  : "Ready"}
            </Typography.Text>
          </Space>

          <Space size="large" wrap>
            <Space>
              <Switch
                checked={showTimes}
                onChange={setShowTimes}
                aria-label="Show timestamps"
              />
              <span>Timestamps</span>
            </Space>
            <Space>
              <Switch
                checked={onDevice}
                onChange={setOnDevice}
                aria-label="On-device recognition"
              />
              <span>On-device (experimental, Chrome 139+)</span>
            </Space>
          </Space>

          {speech.error && (
            <Alert type="error" showIcon message={speech.error} />
          )}

          <div className="transcript-box" ref={boxRef} aria-live="polite">
            {!segments.length && !interim && (
              <Typography.Text type="secondary">
                Your transcript appears here as people speak.
              </Typography.Text>
            )}
            {segments.map((s) => (
              <p key={s.id} style={{ margin: "0 0 8px" }}>
                {showTimes && (
                  <Typography.Text
                    type="secondary"
                    style={{
                      marginRight: 8,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDuration(s.at)}
                  </Typography.Text>
                )}
                {s.text}
              </p>
            ))}
            {interim && (
              <p style={{ margin: 0, color: "#8c8c8c", fontStyle: "italic" }}>
                {interim}
              </p>
            )}
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional), e.g. Team sync, Chemistry lecture"
            maxLength={120}
          />

          <Space wrap>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!segments.length}
              onClick={save}
            >
              Save
            </Button>
            <Button
              icon={<BookOutlined />}
              disabled={plainText.length < 200}
              onClick={() => makeStudySet(plainText, defaultTitle())}
            >
              Make study set
            </Button>
            <Button
              icon={<CopyOutlined />}
              disabled={!segments.length}
              onClick={copy}
            >
              Copy
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!segments.length}
              onClick={() =>
                downloadText(
                  `${safeFilename(defaultTitle())}.txt`,
                  showTimes ? timedText : plainText,
                )
              }
            >
              Download
            </Button>
            <Popconfirm
              title="Discard this transcript?"
              okText="Discard"
              okButtonProps={{ danger: true }}
              onConfirm={speech.reset}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!segments.length}
              >
                Clear
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>

      <Collapse
        items={[
          {
            key: "tips",
            label: "Tips for in-person and online meetings",
            children: (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  The browser only hears your microphone. For an in-person
                  meeting, place the device near the speakers.
                </li>
                <li>
                  For an online meeting (Zoom, Meet, Teams), play the call
                  through your speakers so the microphone can pick it up, or use
                  a second device next to the speaker. Headphones keep the other
                  side out of the transcript.
                </li>
                <li>
                  Most browsers send audio to their speech service, so an
                  internet connection is needed. The on-device switch works only
                  where the browser supports it and the language pack is
                  installed.
                </li>
                <li>
                  Recognition pauses itself during silence; this page restarts
                  it automatically. Your draft is kept on this device until you
                  save or clear it.
                </li>
              </ul>
            ),
          },
        ]}
      />

      <Card bordered={false} title="Saved transcripts">
        <List
          loading={saved === null}
          dataSource={saved ?? []}
          locale={{ emptyText: <Empty description="Nothing saved yet." /> }}
          renderItem={(t) => (
            <List.Item
              actions={[
                <Button
                  key="s"
                  type="link"
                  onClick={() => makeStudySet(t.text, t.title)}
                >
                  Make study set
                </Button>,
                <Button
                  key="d"
                  type="link"
                  onClick={() =>
                    downloadText(`${safeFilename(t.title)}.txt`, t.text)
                  }
                >
                  Download
                </Button>,
                <Popconfirm
                  key="x"
                  title="Delete this transcript?"
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteTranscript(t.id)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Delete transcript"
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={t.title}
                description={`${dayjs(t.createdAt.toMillis()).format("MMM D, YYYY HH:mm")} · ${formatDuration(t.durationSec)}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
