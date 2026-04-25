/**
 * StudyCoach.jsx
 * Drop this into your pages or components folder.
 * 
 * Usage:
 *   import StudyCoach from './components/StudyCoach'
 * 
 *   <StudyCoach
 *     sessions={yourSessionsArray}
 *     subjects={yourSubjectsArray}
 *     exams={yourExamsArray}
 *   />
 *
 * Props shape (adapt to your actual data):
 *   sessions: Array<{ date, subject, durationMinutes, dws, notes }>
 *   subjects: Array<string>
 *   exams:    Array<{ name, subject, date }>
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStudyCoach, SUGGESTED_PROMPTS } from "../hooks/useStudyCoach";

// ── Markdown-lite renderer (bold, bullets — no library needed) ────────────────
function SimpleMarkdown({ text }) {
  const lines = text.split("\n");
  return (
    <div className="sc-prose">
      {lines.map((line, i) => {
        // Bold: **text**
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        if (line.startsWith("• ") || line.startsWith("- ")) {
          return <li key={i} dangerouslySetInnerHTML={{ __html: rendered.replace(/^[•\-]\s/, "") }} />;
        }
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: rendered }} />;
      })}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ role }) {
  return (
    <div className={`sc-avatar sc-avatar--${role}`}>
      {role === "assistant" ? "✦" : "U"}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      className={`sc-message sc-message--${message.role}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {!isUser && <Avatar role="assistant" />}
      <div className={`sc-bubble sc-bubble--${message.role}`}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <SimpleMarkdown text={message.content} />
        )}
      </div>
      {isUser && <Avatar role="user" />}
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      className="sc-message sc-message--assistant"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Avatar role="assistant" />
      <div className="sc-bubble sc-bubble--assistant sc-bubble--typing">
        <span /><span /><span />
      </div>
    </motion.div>
  );
}

// ── Suggested prompt chips ────────────────────────────────────────────────────
function SuggestedPrompts({ onSelect }) {
  return (
    <motion.div
      className="sc-suggestions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <p className="sc-suggestions__label">Try asking</p>
      <div className="sc-suggestions__chips">
        {SUGGESTED_PROMPTS.map((p) => (
          <button key={p} className="sc-chip" onClick={() => onSelect(p)}>
            {p}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudyCoach({ sessions = [], subjects = [], exams = [], apiKey = "" }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { messages, isLoading, error, remaining, sendMessage, clearChat } = useStudyCoach({
    sessions,
    subjects,
    exams,
    apiKey,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text) => {
    const toSend = text ?? input;
    if (!toSend.trim() || isLoading) return;
    setInput("");
    await sendMessage(toSend);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        .sc-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 500px;
          max-height: 700px;
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          background: var(--sc-bg, #0f0f11);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          position: relative;
        }

        /* ── Header ── */
        .sc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .sc-header__left { display: flex; align-items: center; gap: 10px; }
        .sc-header__icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #6e56cf, #3ecfcf);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
        }
        .sc-header__title { font-size: 15px; font-weight: 600; color: #f0f0f0; }
        .sc-header__sub { font-size: 11px; color: #666; margin-top: 1px; }
        .sc-header__actions { display: flex; align-items: center; gap: 8px; }
        .sc-rate-badge {
          font-size: 11px; padding: 3px 9px; border-radius: 20px;
          background: rgba(110, 86, 207, 0.15);
          color: #9b8ce8;
          border: 1px solid rgba(110,86,207,0.25);
        }
        .sc-rate-badge--low { background: rgba(239,68,68,0.12); color: #f87171; border-color: rgba(239,68,68,0.25); }
        .sc-clear-btn {
          font-size: 12px; padding: 4px 10px;
          background: transparent; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px; color: #666; cursor: pointer;
          transition: all 0.15s;
        }
        .sc-clear-btn:hover { color: #aaa; border-color: rgba(255,255,255,0.2); }

        /* ── Messages area ── */
        .sc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }

        /* ── Empty state ── */
        .sc-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          gap: 8px;
        }
        .sc-empty__icon { font-size: 32px; margin-bottom: 8px; }
        .sc-empty__title { font-size: 17px; font-weight: 600; color: #e0e0e0; }
        .sc-empty__sub { font-size: 13px; color: #555; max-width: 280px; line-height: 1.5; }

        /* ── Suggestions ── */
        .sc-suggestions { margin-top: 24px; }
        .sc-suggestions__label { font-size: 11px; color: #444; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .sc-suggestions__chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
        .sc-chip {
          font-size: 12px; padding: 7px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; color: #bbb;
          cursor: pointer; transition: all 0.15s;
          font-family: inherit;
        }
        .sc-chip:hover {
          background: rgba(110,86,207,0.15);
          border-color: rgba(110,86,207,0.4);
          color: #c4b5fd;
        }

        /* ── Message layout ── */
        .sc-message {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }
        .sc-message--user { flex-direction: row-reverse; }

        /* ── Avatar ── */
        .sc-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; flex-shrink: 0;
        }
        .sc-avatar--assistant {
          background: linear-gradient(135deg, #6e56cf, #3ecfcf);
          color: #fff;
        }
        .sc-avatar--user {
          background: rgba(255,255,255,0.1);
          color: #bbb;
          font-size: 11px;
        }

        /* ── Bubbles ── */
        .sc-bubble {
          max-width: 75%;
          padding: 11px 15px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.6;
        }
        .sc-bubble--assistant {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-bottom-left-radius: 4px;
          color: #ddd;
        }
        .sc-bubble--user {
          background: linear-gradient(135deg, #6e56cf, #5b4ab5);
          border-bottom-right-radius: 4px;
          color: #fff;
        }

        /* ── Typing dots ── */
        .sc-bubble--typing {
          display: flex; align-items: center; gap: 5px;
          padding: 14px 18px;
        }
        .sc-bubble--typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #555;
          animation: sc-bounce 1.2s infinite ease-in-out;
        }
        .sc-bubble--typing span:nth-child(2) { animation-delay: 0.2s; }
        .sc-bubble--typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes sc-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* ── Prose styles inside assistant bubble ── */
        .sc-prose p { margin: 0 0 6px; }
        .sc-prose p:last-child { margin: 0; }
        .sc-prose li { margin: 3px 0 3px 16px; list-style: disc; }
        .sc-prose strong { color: #fff; font-weight: 600; }
        .sc-prose br { display: block; margin: 4px 0; content: ""; }

        /* ── Error ── */
        .sc-error {
          margin: 0 20px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          font-size: 13px;
          color: #f87171;
          flex-shrink: 0;
        }

        /* ── Input area ── */
        .sc-input-area {
          padding: 12px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: flex-end;
          gap: 10px;
          background: rgba(255,255,255,0.02);
          flex-shrink: 0;
        }
        .sc-textarea {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          color: #e0e0e0;
          font-family: inherit;
          resize: none;
          min-height: 42px;
          max-height: 120px;
          outline: none;
          transition: border-color 0.15s;
          line-height: 1.5;
        }
        .sc-textarea::placeholder { color: #444; }
        .sc-textarea:focus { border-color: rgba(110,86,207,0.5); }
        .sc-send-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #6e56cf, #5b4ab5);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 16px;
          flex-shrink: 0;
          transition: opacity 0.15s, transform 0.1s;
        }
        .sc-send-btn:hover { opacity: 0.85; }
        .sc-send-btn:active { transform: scale(0.94); }
        .sc-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .sc-send-btn svg { width: 16px; height: 16px; fill: currentColor; }
      `}</style>

      <div className="sc-root">
        {/* Header */}
        <div className="sc-header">
          <div className="sc-header__left">
            <div className="sc-header__icon">✦</div>
            <div>
              <div className="sc-header__title">Study Coach</div>
              <div className="sc-header__sub">Powered by Claude · knows your history</div>
            </div>
          </div>
          <div className="sc-header__actions">
            <span className={`sc-rate-badge ${remaining <= 1 ? "sc-rate-badge--low" : ""}`}>
              {remaining}/{5} left today
            </span>
            {messages.length > 0 && (
              <button className="sc-clear-btn" onClick={clearChat}>Clear</button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="sc-messages">
          {messages.length === 0 && !isLoading ? (
            <div className="sc-empty">
              <div className="sc-empty__icon">✦</div>
              <div className="sc-empty__title">Your personal study coach</div>
              <div className="sc-empty__sub">
                Ask me anything about your study patterns, what to focus on, or get a custom study plan.
              </div>
              <SuggestedPrompts onSelect={(p) => handleSend(p)} />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isLoading && <TypingIndicator />}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && <div className="sc-error">{error}</div>}

        {/* Input */}
        <div className="sc-input-area">
          <textarea
            ref={inputRef}
            className="sc-textarea"
            placeholder={remaining > 0 ? "Ask your study coach…" : "Daily limit reached — come back tomorrow"}
            value={input}
            disabled={remaining <= 0 || isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="sc-send-btn"
            disabled={!input.trim() || isLoading || remaining <= 0}
            onClick={() => handleSend()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}
