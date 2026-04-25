/**
 * CoachPage.jsx  (or drop <StudyCoach> anywhere in your existing layout)
 *
 * This example shows how to pull real data from your localStorage
 * and pass it into the StudyCoach component.
 *
 * Adapt the localStorage keys and data shape to match YOUR app.
 */

import { useMemo } from "react";
import StudyCoach from "../components/StudyCoach";

// ── Helper: read your app's localStorage data ─────────────────────────────────
function useStudyData() {
  return useMemo(() => {
    // These keys now match your main App.jsx
    const rawSessions = localStorage.getItem("studyTracker_sessions");
    const rawExams    = localStorage.getItem("studyTracker_exams");
    const rawSubjects = localStorage.getItem("studyTracker_subjects");

    let sessions = [];
    let exams = [];
    let subjects = [];

    try { sessions = JSON.parse(rawSessions) ?? []; } catch { /* no data yet */ }
    try { exams    = JSON.parse(rawExams)    ?? []; } catch { /* no data yet */ }
    try { subjects = JSON.parse(rawSubjects) ?? []; } catch { /* no data yet */ }

    return { sessions, exams, subjects };
  }, []);
}

export default function CoachPage() {
  const { sessions, exams, subjects } = useStudyData();
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

  return (
    <div style={{ padding: "24px", maxWidth: "720px", margin: "0 auto", height: "calc(100vh - 48px)" }}>
      <StudyCoach
        sessions={sessions}
        subjects={subjects}
        exams={exams}
        apiKey={apiKey}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED DATA SHAPES
// (adapt buildStudyContext.js if your shapes differ)
// ─────────────────────────────────────────────────────────────────────────────
//
// sessions: [
//   {
//     date: "2025-04-20",          // ISO date string
//     subject: "Mathematics",
//     durationMinutes: 45,
//     dws: 3.8,                    // Deep Work Score 1–5 (optional)
//     notes: "Covered integration" // optional
//   },
//   ...
// ]
//
// exams: [
//   {
//     name: "JEE Advanced",
//     subject: "Physics",
//     date: "2025-05-20"
//   },
//   ...
// ]
//
// subjects: ["Mathematics", "Physics", "Chemistry"]  // simple string array
