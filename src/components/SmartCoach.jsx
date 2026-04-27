import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  analyzeStudyData,
  generateInsights,
  getDailyFocus,
  answerQuestion,
  COACH_QUESTIONS,
} from "../utils/coachEngine";

function Md({ text }) {
  const html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const TYPE = {
  warning: { bg: "#FFF7ED", border: "#F59E0B", icon: "▲", label: "#92400E" },
  success: { bg: "#F0FDF4", border: "#22C55E", icon: "✓", label: "#166534" },
  info: { bg: "#EFF6FF", border: "#3B82F6", icon: "●", label: "#1E40AF" },
  tip: { bg: "#F5F3FF", border: "#8B5CF6", icon: "◆", label: "#5B21B6" },
};

function ChatMsg({ msg }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            marginRight: 8,
            alignSelf: "flex-end",
          }}
        >
          SC
        </div>
      )}
      <div
        style={{
          maxWidth: "78%",
          padding: "9px 13px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser ? "#1d4ed8" : "#f4f4f5",
          color: isUser ? "#fff" : "#18181b",
          fontSize: 13.5,
          lineHeight: 1.6,
        }}
      >
        <Md text={msg.content} />
      </div>
    </motion.div>
  );
}

export default function SmartCoach({ sessions = [], exams = [], reviewTopics = [] }) {
  const [tab, setTab] = useState("insights");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your Study Coach. I've analysed your sessions, exams, and review data. Ask me anything below, or pick a question to start.",
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  const data = useMemo(
    () => analyzeStudyData({ sessions, exams, reviewTopics }),
    [sessions, exams, reviewTopics],
  );

  const insights = useMemo(() => generateInsights(data), [data]);
  const focus = useMemo(() => getDailyFocus(data), [data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    const reply = { role: "assistant", content: answerQuestion(text, data) };
    setMessages((prev) => [...prev, userMsg, reply]);
    setInput("");
  };

  const tabs = [
    { id: "insights", label: "Insights" },
    { id: "focus", label: "Today's Focus" },
    { id: "chat", label: "Ask Coach" },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e4e4f7",
        overflow: "hidden",
        maxWidth: 680,
        margin: "0 auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)",
          padding: "18px 20px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            SC
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>Smart Coach</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
              {data.sessionCount} sessions · {data.totalHours.toFixed(1)}h total · {data.currentStreak}d streak
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 11,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 500,
            }}
          >
            Rule-based · Free
          </div>
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "8px 8px 0 0",
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? "#1e3a8a" : "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minHeight: 420 }}>
        <AnimatePresence mode="wait">
          {tab === "insights" && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ padding: 20 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "This week", value: `${data.thisWeekHours.toFixed(1)}h` },
                  { label: "Consistency", value: `${data.consistencyPct}%` },
                  { label: "Avg DWS", value: data.allDws ? data.allDws.toFixed(1) : "—" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: "#f9f9fb",
                      borderRadius: 10,
                      padding: "10px 12px",
                      border: "1px solid #e4e4f7",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#71717a", marginBottom: 2 }}>{stat.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#18181b" }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {insights.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#71717a", fontSize: 14 }}>
                  Log a few sessions and I'll generate personalised insights.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {insights.map((ins, i) => {
                    const t = TYPE[ins.type];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        style={{
                          background: t.bg,
                          border: `1px solid ${t.border}40`,
                          borderLeft: `3px solid ${t.border}`,
                          borderRadius: 10,
                          padding: "11px 14px",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ color: t.border, fontSize: 12, marginTop: 2, flexShrink: 0 }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.label, marginBottom: 2 }}>{ins.title}</div>
                          <div style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.55 }}>{ins.body}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === "focus" && (
            <motion.div
              key="focus"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ padding: 20 }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #eff6ff, #f5f3ff)",
                  border: "1px solid #c7d2fe",
                  borderRadius: 14,
                  padding: "24px 20px",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6366f1",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Study this today
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#1e1b4b", marginBottom: 10 }}>
                  {focus.subject ?? "Start logging sessions"}
                </div>
                <div style={{ fontSize: 14, color: "#4338ca", lineHeight: 1.6 }}>{focus.reason}</div>
              </div>

              {data.urgentExams.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#71717a",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 8,
                    }}
                  >
                    Upcoming exams
                  </div>
                  {data.urgentExams.slice(0, 3).map((exam) => {
                    const urgent = exam.daysLeft <= 7;
                    return (
                      <div
                        key={exam.id ?? exam.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: urgent ? "#FFF7ED" : "#f9f9fb",
                          border: `1px solid ${urgent ? "#F59E0B40" : "#e4e4e7"}`,
                          borderRadius: 10,
                          marginBottom: 8,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "#18181b" }}>{exam.name}</div>
                          <div style={{ color: "#71717a", fontSize: 12 }}>{exam.subject || "All subjects"}</div>
                        </div>
                        <div
                          style={{
                            background: urgent ? "#FEF3C7" : "#f4f4f5",
                            color: urgent ? "#92400E" : "#52525b",
                            borderRadius: 20,
                            padding: "3px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {exam.daysLeft}d
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {data.dueReviews.length > 0 && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a540",
                    borderLeft: "3px solid #ef4444",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#7f1d1d",
                  }}
                >
                  <strong>{data.dueReviews.length} review{data.dueReviews.length > 1 ? "s" : ""}</strong> due today — clear these before new content.
                </div>
              )}
            </motion.div>
          )}

          {tab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", flexDirection: "column", height: 420 }}
            >
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px" }}>
                {messages.map((m, i) => (
                  <ChatMsg key={i} msg={m} />
                ))}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COACH_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      fontSize: 12,
                      padding: "5px 11px",
                      background: "#f4f4f5",
                      border: "1px solid #e4e4e7",
                      borderRadius: 20,
                      color: "#3f3f46",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.12s",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = "#eff6ff";
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.color = "#1d4ed8";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = "#f4f4f5";
                      e.target.style.borderColor = "#e4e4e7";
                      e.target.style.color = "#3f3f46";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "10px 16px",
                  borderTop: "1px solid #f4f4f5",
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                  placeholder="Ask your coach anything…"
                  style={{
                    flex: 1,
                    padding: "9px 13px",
                    border: "1px solid #e4e4f7",
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    outline: "none",
                    color: "#18181b",
                    background: "#fafafa",
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#1d4ed8",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: input.trim() ? 1 : 0.4,
                    transition: "opacity 0.15s",
                    flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
