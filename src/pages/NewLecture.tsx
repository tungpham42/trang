import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Tabs,
  Typography,
  Upload,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { DENSITIES, LANGUAGES, MAX_SOURCE_CHARS } from "../lib/constants";
import { createLecture } from "../lib/db";
import { extractFromFile } from "../lib/extract";
import { runPipeline } from "../lib/pipeline";
import type { Density, SourceType } from "../lib/types";

interface Prefill {
  text?: string;
  title?: string;
  sourceType?: SourceType;
}

export default function NewLecture() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const prefill = (useLocation().state as Prefill | null) ?? {};

  const [tab, setTab] = useState<"file" | "text">(
    prefill.text ? "text" : "file",
  );
  const [title, setTitle] = useState(prefill.title ?? "");
  const [text, setText] = useState(prefill.text ?? "");
  const [source, setSource] = useState<{ type: SourceType; name?: string }>({
    type: prefill.sourceType ?? "text",
  });
  const [reading, setReading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const [density, setDensity] = useState<Density>("normal");
  const [submitting, setSubmitting] = useState(false);

  const estimatedCalls = text.trim()
    ? Math.ceil(text.length / 6000) * 2 + 4
    : 0;

  const handleFile = async (file: File) => {
    setReading(true);
    setWarning(null);
    try {
      const result = await extractFromFile(file);
      setText(result.text);
      setSource({ type: result.sourceType, name: file.name });
      setWarning(result.warning ?? null);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Could not read this file.",
      );
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    const clean = text.trim();
    if (clean.length < 20) {
      message.warning(
        "Add a little more material first (at least a few paragraphs).",
      );
      return;
    }
    if (clean.length > MAX_SOURCE_CHARS) {
      message.error(
        "This is too long for one study set. Split it into parts and create them separately.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const lectureTitle = title.trim() || "Untitled lecture";
      const id = await createLecture(user.uid, {
        title: lectureTitle,
        sourceType: source.type,
        sourceName: source.name,
        language,
        density,
        charCount: clean.length,
      });
      // Runs in the background; the lecture page follows its progress live.
      void runPipeline({
        uid: user.uid,
        lectureId: id,
        title: lectureTitle,
        text: clean,
        language,
        density,
      });
      navigate(`/lectures/${id}`);
    } catch {
      message.error("Could not start. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        New study set
      </Typography.Title>

      <Card bordered={false}>
        <Form layout="vertical">
          <Form.Item label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cell biology – week 3"
              maxLength={120}
            />
          </Form.Item>

          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as "file" | "text")}
            items={[
              {
                key: "file",
                label: "Upload file",
                children: (
                  <>
                    <Upload.Dragger
                      accept=".pdf,.pptx,.txt,.md"
                      multiple={false}
                      showUploadList={false}
                      disabled={reading}
                      beforeUpload={(file) => {
                        void handleFile(file);
                        return false;
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">
                        {reading
                          ? "Reading file…"
                          : "Click or drop a PDF, PPTX, TXT or MD file here"}
                      </p>
                      <p className="ant-upload-hint">
                        Text is read in your browser; only the text is sent to
                        the AI.
                      </p>
                    </Upload.Dragger>
                    {source.name && !reading && (
                      <Typography.Paragraph
                        type="secondary"
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        {source.name}: {text.length.toLocaleString()} characters
                        read.
                      </Typography.Paragraph>
                    )}
                  </>
                ),
              },
              {
                key: "text",
                label: "Paste text",
                children: (
                  <Input.TextArea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setSource((s) => (s.name ? { type: "text" } : s));
                    }}
                    rows={12}
                    placeholder="Paste a transcript, lecture notes or any study material…"
                  />
                ),
              },
            ]}
          />

          {warning && (
            <Alert
              type="warning"
              showIcon
              message={warning}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item label="Write the summary and flashcards in">
            <Select
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
              style={{ maxWidth: 280 }}
            />
          </Form.Item>

          <Form.Item label="How many flashcards?">
            <Radio.Group
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
            >
              <Space direction="vertical">
                {DENSITIES.map((d) => (
                  <Radio key={d.value} value={d.value}>
                    {d.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          {estimatedCalls > 0 && (
            <Typography.Paragraph type="secondary">
              About {estimatedCalls} AI requests. Long lectures take a few
              minutes; you can leave the page while it runs, but keep this
              browser tab open.
            </Typography.Paragraph>
          )}

          <Button
            type="primary"
            size="large"
            loading={submitting || reading}
            onClick={submit}
            disabled={!text.trim()}
          >
            Create summary and flashcards
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
