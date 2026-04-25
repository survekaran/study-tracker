/**
 * buildStudyContext.js
 * Converts your app's localStorage study data into a rich
 * text context string that Claude can reason over.
 *
 * Adapt the field names to match YOUR actual data shape.
 */

export function buildStudyContext(sessions = [], subjects = [], exams = []) {
  const now = new Date();

  // ── 1. Aggregate stats per subject ──────────────────────────────────────
  const subjectMap = {};

  sessions.forEach((s) => {
    const subj = s.subject || "Unknown";
    if (!subjectMap[subj]) {
      subjectMap[subj] = { totalMinutes: 0, sessions: 0, dwsTotal: 0, lastStudied: null };
    }
    subjectMap[subj].totalMinutes += s.durationMinutes || 0;
    subjectMap[subj].sessions += 1;
    subjectMap[subj].dwsTotal += s.dws || 0;
    const d = new Date(s.date);
    if (!subjectMap[subj].lastStudied || d > subjectMap[subj].lastStudied) {
      subjectMap[subj].lastStudied = d;
    }
  });

  // ── 2. Recent sessions (last 14 days) ────────────────────────────────────
  const twoWeeksAgo = new Date(now - 14 * 864e5);
  const recentSessions = sessions
    .filter((s) => new Date(s.date) >= twoWeeksAgo)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  // ── 3. Streak calculation ────────────────────────────────────────────────
  const studiedDays = new Set(sessions.map((s) => s.date?.slice(0, 10)));
  let streak = 0;
  const today = now.toISOString().slice(0, 10);
  let check = new Date(now);
  while (studiedDays.has(check.toISOString().slice(0, 10)) || check.toISOString().slice(0, 10) === today) {
    if (studiedDays.has(check.toISOString().slice(0, 10))) streak++;
    check = new Date(check - 864e5);
    if (streak > 365) break; // safety
  }

  // ── 4. Best / worst subject by avg DWS ───────────────────────────────────
  const subjEntries = Object.entries(subjectMap);
  let bestSubj = null, worstSubj = null;
  if (subjEntries.length) {
    const withDws = subjEntries.filter(([, v]) => v.sessions > 0).map(([k, v]) => ({
      name: k,
      avgDws: v.sessions ? (v.dwsTotal / v.sessions).toFixed(1) : 0,
    }));
    withDws.sort((a, b) => b.avgDws - a.avgDws);
    bestSubj = withDws[0];
    worstSubj = withDws[withDws.length - 1];
  }

  // ── 5. Upcoming exams ────────────────────────────────────────────────────
  const upcomingExams = exams
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)
    .map((e) => {
      const daysLeft = Math.ceil((new Date(e.date) - now) / 864e5);
      return `${e.name} (${e.subject}) — ${daysLeft} days away`;
    });

  // ── 6. Weekly hours ──────────────────────────────────────────────────────
  const weekAgo = new Date(now - 7 * 864e5);
  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekAgo);
  const weekMinutes = weekSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  // ── 7. Build the context string ──────────────────────────────────────────
  const lines = [
    `=== STUDENT STUDY PROFILE ===`,
    `Date: ${now.toDateString()}`,
    `Current streak: ${streak} day${streak !== 1 ? "s" : ""}`,
    `Total sessions logged: ${sessions.length}`,
    `Hours studied this week: ${(weekMinutes / 60).toFixed(1)}h`,
    ``,
    `=== SUBJECT BREAKDOWN ===`,
    ...subjEntries.map(([name, v]) => {
      const avgDws = v.sessions ? (v.dwsTotal / v.sessions).toFixed(1) : "N/A";
      const lastStr = v.lastStudied
        ? Math.ceil((now - v.lastStudied) / 864e5) + " days ago"
        : "never";
      return `• ${name}: ${(v.totalMinutes / 60).toFixed(1)}h total, ${v.sessions} sessions, avg DWS ${avgDws}/5, last studied ${lastStr}`;
    }),
    ``,
    `=== PERFORMANCE INSIGHTS ===`,
    bestSubj ? `Best performing subject: ${bestSubj.name} (avg DWS ${bestSubj.avgDws})` : "",
    worstSubj && worstSubj.name !== bestSubj?.name
      ? `Needs most attention: ${worstSubj.name} (avg DWS ${worstSubj.avgDws})`
      : "",
    ``,
    `=== RECENT SESSIONS (last 14 days) ===`,
    ...recentSessions.map(
      (s) =>
        `• ${s.date?.slice(0, 10)} | ${s.subject} | ${s.durationMinutes}min | DWS: ${s.dws ?? "N/A"} | ${s.notes || "no notes"}`
    ),
    ``,
    `=== UPCOMING EXAMS ===`,
    upcomingExams.length ? upcomingExams.join("\n") : "No exams scheduled",
  ];

  return lines.filter((l) => l !== "").join("\n");
}
