/**
 * useStudyCoach.js
 * Custom hook that manages the chat state, rate limiting,
 * and streaming responses from the Anthropic API.
 *
 * Rate limit: 5 messages per day (stored in localStorage).
 * Swap the fetch URL / model as needed.
 */

import { useState, useCallback } from "react";
import { buildStudyContext } from "../utils/buildStudyContext";

const DAILY_LIMIT = 5;
const STORAGE_KEY = "study_coach_usage";

function getUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: null, count: 0 };
    return JSON.parse(raw);
  } catch {
    return { date: null, count: 0 };
  }
}

function incrementUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getUsage();
  const newUsage = {
    date: today,
    count: usage.date === today ? usage.count + 1 : 1,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage));
  return newUsage.count;
}

function getRemainingMessages() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getUsage();
  if (usage.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - usage.count);
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(studyContext) {
  return `You are an elite, empathetic AI study coach built into a personal study tracker app. You have full access to the student's study history, performance metrics, and upcoming exams.

Your personality: encouraging but honest. Like a coach who celebrates wins and flags problems before they become crises. Never vague — always specific and actionable.

STUDENT DATA:
${studyContext}

CAPABILITIES YOU HAVE:
- Analyze patterns in their study data
- Identify subjects they're neglecting or overworking
- Create personalized weekly study plans
- Diagnose why a subject feels hard (too infrequent = forgetting curve, low DWS = distraction issues, etc.)
- Prioritize prep around upcoming exams
- Motivate without being patronizing

RESPONSE RULES:
- Keep responses under 200 words unless writing a full study plan
- Use bullet points only when listing 3+ items
- Reference their actual data (hours, subjects, DWS scores, streak) — never give generic advice
- If they ask something unrelated to studying, gently redirect
- If data is sparse (new user), work with what you have and ask clarifying questions`;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────
export const SUGGESTED_PROMPTS = [
  "What should I focus on this week?",
  "Why am I struggling with my weakest subject?",
  "Build me a study plan for my next exam",
  "How's my consistency lately? Be honest.",
  "Which subject am I neglecting the most?",
];

// ─── The hook ─────────────────────────────────────────────────────────────────
export function useStudyCoach({ sessions = [], subjects = [], exams = [], apiKey = "" } = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(getRemainingMessages);

  const sendMessage = useCallback(
    async (userText) => {
      if (!userText.trim()) return;
      if (remaining <= 0) {
        setError("Daily limit reached. You get 5 AI messages per day — come back tomorrow!");
        return;
      }

      if (!apiKey) {
        setError("⚠️ API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env file");
        return;
      }

      const userMsg = { role: "user", content: userText, id: Date.now() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);
      setError(null);

      // Build conversation history for the API (role + content only)
      const apiMessages = updatedMessages.map(({ role, content }) => ({ role, content }));

      try {
        const studyContext = buildStudyContext(sessions, subjects, exams);
        const systemPrompt = buildSystemPrompt(studyContext);

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: systemPrompt,
            messages: apiMessages,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error?.message || `API error ${response.status}`);
        }

        const data = await response.json();
        const replyText =
          data.content?.find((b) => b.type === "text")?.text ?? "Sorry, I couldn't generate a response.";

        const assistantMsg = {
          role: "assistant",
          content: replyText,
          id: Date.now() + 1,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        const newCount = incrementUsage();
        setRemaining(Math.max(0, DAILY_LIMIT - newCount));
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
        // Remove the user message on failure so they can retry
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, remaining, sessions, subjects, exams, apiKey]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, remaining, sendMessage, clearChat };
}
