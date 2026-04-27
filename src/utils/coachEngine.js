/**
 * coachEngine.js
 * Pure rule-based coach — no API, no cost, fully offline.
 * Reads your existing session/exam/review data and produces
 * typed insights, a daily focus, and answers to preset questions.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function daysBetween(fromKey, toKey) {
  return Math.round(
    (new Date(`${toKey}T00:00:00`) - new Date(`${fromKey}T00:00:00`)) / 86400000
  );
}

function hoursFor(sessions) {
  return sessions.reduce((s, x) => s + x.durationMinutes / 60, 0);
}

function avgDws(sessions) {
  const valid = sessions.filter((s) => Number.isFinite(s.dws));
  if (!valid.length) return null;
  return valid.reduce((s, x) => s + x.dws, 0) / valid.length;
}

function startOfWeek(dateKey = toDateKey()) {
  const d = new Date(`${dateKey}T00:00:00`);
  const off = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + off);
  return toDateKey(d);
}

function subjectTotals(sessions) {
  return sessions.reduce((acc, s) => {
    acc[s.subject] = (acc[s.subject] ?? 0) + s.durationMinutes / 60;
    return acc;
  }, {});
}

function getTimeBucket(session) {
  const h = session.hour ?? (session.startedAt ? new Date(session.startedAt).getHours() : null);
  if (h === null) return null;
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

function streak(sessions, today = toDateKey()) {
  const days = new Set(sessions.map((s) => s.date));
  let count = 0, cursor = today;
  while (days.has(cursor)) { count++; cursor = addDays(cursor, -1); }
  return count;
}

// ── Core analysis ─────────────────────────────────────────────────────────────

export function analyzeStudyData({ sessions = [], exams = [], reviewTopics = [] }) {
  const today = toDateKey();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);

  const thisWeek = sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd);
  const lastWeek = sessions.filter((s) => s.date >= prevStart && s.date <= prevEnd);
  const last30 = sessions.filter((s) => daysBetween(s.date, today) <= 30);

  const thisWeekHours = hoursFor(thisWeek);
  const lastWeekHours = hoursFor(lastWeek);
  const totalHours = hoursFor(sessions);

  const thisSubjects = subjectTotals(thisWeek);
  const lastSubjects = subjectTotals(lastWeek);
  const allSubjects = subjectTotals(sessions);

  const currentStreak = streak(sessions, today);
  const currentDws = avgDws(thisWeek);
  const prevDws = avgDws(lastWeek);
  const allDws = avgDws(sessions);

  // Best time of day
  const buckets = {};
  thisWeek.forEach((s) => {
    const b = getTimeBucket(s);
    if (b) buckets[b] = (buckets[b] ?? 0) + s.durationMinutes / 60;
  });
  const bestTime = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Neglected subject (studied last week but dropped >40% this week)
  const neglected = Object.entries(lastSubjects)
    .map(([name, prev]) => ({ name, prev, curr: thisSubjects[name] ?? 0 }))
    .filter((x) => x.prev > 0.5 && ((x.prev - x.curr) / x.prev) > 0.4)
    .sort((a, b) => (b.prev - b.curr) / b.prev - (a.prev - a.curr) / a.prev)[0] ?? null;

  // Most studied subject overall
  const topSubject = Object.entries(allSubjects).sort((a, b) => b[1] - a[1])[0] ?? null;

  // Weakest subject by avg DWS (min 2 sessions)
  const dwsBySubject = {};
  sessions.forEach((s) => {
    if (!Number.isFinite(s.dws)) return;
    if (!dwsBySubject[s.subject]) dwsBySubject[s.subject] = [];
    dwsBySubject[s.subject].push(s.dws);
  });
  const weakest = Object.entries(dwsBySubject)
    .filter(([, arr]) => arr.length >= 2)
    .map(([name, arr]) => ({ name, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => a.avg - b.avg)[0] ?? null;

  // Upcoming exams (next 30 days)
  const urgentExams = exams
    .map((e) => ({ ...e, daysLeft: daysBetween(today, e.date) }))
    .filter((e) => e.daysLeft >= 0 && e.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Due reviews
  const dueReviews = reviewTopics.filter((t) => daysBetween(t.nextReview, today) >= 0);
  const overdueReviews = reviewTopics.filter((t) => daysBetween(t.nextReview, today) > 2);

  // Consistency score (% of last 14 days with a session)
  const studiedDays = new Set(sessions.map((s) => s.date));
  let activeDays = 0;
  for (let i = 0; i < 14; i++) {
    if (studiedDays.has(addDays(today, -i))) activeDays++;
  }
  const consistencyPct = Math.round((activeDays / 14) * 100);

  return {
    today,
    totalHours,
    thisWeekHours,
    lastWeekHours,
    currentStreak,
    currentDws,
    prevDws,
    allDws,
    bestTime,
    neglected,
    topSubject,
    weakest,
    urgentExams,
    dueReviews,
    overdueReviews,
    allSubjects,
    thisSubjects,
    lastSubjects,
    consistencyPct,
    sessionCount: sessions.length,
    hasData: sessions.length > 0,
  };
}

// ── Insight generator ─────────────────────────────────────────────────────────

/**
 * Returns an array of insight objects:
 * { type: 'warning'|'success'|'info'|'tip', title, body }
 */
export function generateInsights(data) {
  const insights = [];
  const { hasData } = data;

  if (!hasData) {
    insights.push({
      type: "info",
      title: "No sessions yet",
      body: "Log your first study session and I'll start analysing your patterns immediately.",
    });
    return insights;
  }

  // Streak
  if (data.currentStreak >= 7) {
    insights.push({ type: "success", title: `${data.currentStreak}-day streak`, body: "You're consistent. Protect this by scheduling even a 20-min session on rest days." });
  } else if (data.currentStreak === 0) {
    insights.push({ type: "warning", title: "Streak broken", body: "Study anything for 20 minutes today to restart momentum — the subject doesn't matter." });
  } else if (data.currentStreak >= 3) {
    insights.push({ type: "info", title: `${data.currentStreak}-day streak`, body: "Building momentum. 7 days is the habit-formation threshold — keep going." });
  }

  // Week over week
  if (data.lastWeekHours > 1) {
    const delta = data.thisWeekHours - data.lastWeekHours;
    const pct = Math.round(Math.abs(delta / data.lastWeekHours) * 100);
    if (delta < -0.5) {
      insights.push({ type: "warning", title: `Study time down ${pct}%`, body: `You studied ${data.lastWeekHours.toFixed(1)}h last week but only ${data.thisWeekHours.toFixed(1)}h so far this week. Add one recovery session before Sunday.` });
    } else if (delta > 0.5) {
      insights.push({ type: "success", title: `Study time up ${pct}%`, body: `${data.thisWeekHours.toFixed(1)}h this week vs ${data.lastWeekHours.toFixed(1)}h last week. Solid improvement.` });
    }
  }

  // DWS quality
  if (data.currentDws !== null && data.prevDws !== null) {
    const dwsDelta = data.currentDws - data.prevDws;
    if (dwsDelta < -0.5) {
      insights.push({ type: "warning", title: "Focus quality dipping", body: `Your average DWS dropped from ${data.prevDws.toFixed(1)} to ${data.currentDws.toFixed(1)}. Try shorter 30-min blocks with one defined goal per session.` });
    } else if (dwsDelta >= 0.5) {
      insights.push({ type: "success", title: "Focus quality improving", body: `DWS up from ${data.prevDws.toFixed(1)} to ${data.currentDws.toFixed(1)}. Whatever you changed this week — keep it.` });
    }
  }

  // Neglected subject
  if (data.neglected) {
    const drop = Math.round(((data.neglected.prev - data.neglected.curr) / data.neglected.prev) * 100);
    insights.push({ type: "warning", title: `${data.neglected.name} neglected`, body: `You studied ${data.neglected.name} for ${data.neglected.prev.toFixed(1)}h last week but only ${data.neglected.curr.toFixed(1)}h this week — a ${drop}% drop. Schedule a block today.` });
  }

  // Weakest subject
  if (data.weakest && data.weakest.avg < 3) {
    insights.push({ type: "tip", title: `Low focus in ${data.weakest.name}`, body: `Your average DWS in ${data.weakest.name} is ${data.weakest.avg.toFixed(1)}/5. Study this subject first in your session while mental energy is highest.` });
  }

  // Urgent exams
  data.urgentExams.slice(0, 2).forEach((exam) => {
    const urgency = exam.daysLeft <= 7 ? "warning" : "info";
    insights.push({ type: urgency, title: `${exam.name} in ${exam.daysLeft} days`, body: `Front-load recall practice now. Passive re-reading won't move your retention at this stage — use active recall and past papers.` });
  });

  // Overdue reviews
  if (data.overdueReviews.length > 0) {
    insights.push({ type: "warning", title: `${data.overdueReviews.length} overdue review${data.overdueReviews.length > 1 ? "s" : ""}`, body: `Topics overdue: ${data.overdueReviews.slice(0, 3).map((t) => t.topic).join(", ")}. Clear these before adding new material — skipping reviews collapses retention.` });
  }

  // Best time
  if (data.bestTime) {
    insights.push({ type: "tip", title: `Your peak window: ${data.bestTime}`, body: `You log the most hours in the ${data.bestTime.toLowerCase()}. Schedule your hardest subject here and protect it from distractions.` });
  }

  // Consistency
  if (data.consistencyPct < 50) {
    insights.push({ type: "tip", title: "Consistency below 50%", body: `You've studied on ${Math.round(data.consistencyPct / 100 * 14)} of the last 14 days. Even 20 minutes daily beats long infrequent sessions for retention.` });
  } else if (data.consistencyPct >= 85) {
    insights.push({ type: "success", title: `${data.consistencyPct}% consistency`, body: "You're studying on almost every day. This level of consistency compounds heavily over weeks." });
  }

  return insights.slice(0, 6);
}

// ── Daily focus recommendation ─────────────────────────────────────────────────

export function getDailyFocus(data) {
  if (!data.hasData) return { subject: null, reason: "Log a session first — then I'll recommend what to study today." };

  // If urgent exam — prioritise its subject
  if (data.urgentExams.length > 0) {
    const exam = data.urgentExams[0];
    return {
      subject: exam.subject || exam.name,
      reason: `${exam.name} is ${exam.daysLeft} day${exam.daysLeft !== 1 ? "s" : ""} away. Active recall over new content today.`,
    };
  }

  // If overdue reviews
  if (data.overdueReviews.length > 0) {
    return {
      subject: data.overdueReviews[0].topic,
      reason: `This review is overdue. Clear it now before the memory trace fades further.`,
    };
  }

  // If neglected subject
  if (data.neglected) {
    return {
      subject: data.neglected.name,
      reason: `Down ${Math.round(((data.neglected.prev - data.neglected.curr) / data.neglected.prev) * 100)}% from last week. One focused block will rebalance your week.`,
    };
  }

  // Weakest DWS subject
  if (data.weakest) {
    return {
      subject: data.weakest.name,
      reason: `Avg DWS of ${data.weakest.avg.toFixed(1)}/5 — your focus here is lowest. Tackle it when you're freshest.`,
    };
  }

  // Top subject momentum
  if (data.topSubject) {
    return {
      subject: data.topSubject[0],
      reason: `You've invested the most time here. Keep the momentum and go deeper.`,
    };
  }

  return { subject: null, reason: "Keep studying — more data will sharpen my recommendations." };
}

// ── Preset Q&A ────────────────────────────────────────────────────────────────

export const COACH_QUESTIONS = [
  "What should I study today?",
  "How's my consistency?",
  "What's my weakest area?",
  "Am I ready for my next exam?",
  "How was my focus this week?",
  "What's my study pattern?",
];

export function answerQuestion(question, data) {
  const q = question.toLowerCase();

  if (q.includes("today") || q.includes("study now") || q.includes("focus on")) {
    const focus = getDailyFocus(data);
    if (!focus.subject) return focus.reason;
    return `Study **${focus.subject}** today. ${focus.reason}`;
  }

  if (q.includes("consist")) {
    const days = Math.round(data.consistencyPct / 100 * 14);
    if (data.consistencyPct >= 80) return `You've studied on ${days} of the last 14 days (${data.consistencyPct}%). That's excellent consistency — most students manage under 50%.`;
    if (data.consistencyPct >= 50) return `You've studied on ${days} of the last 14 days (${data.consistencyPct}%). Decent, but there's room to tighten it. Aim for daily sessions even if short.`;
    return `You've studied on ${days} of the last 14 days (${data.consistencyPct}%). Frequency matters more than duration for retention. Try a 20-minute minimum rule on off days.`;
  }

  if (q.includes("weak") || q.includes("struggle") || q.includes("worst")) {
    if (!data.weakest && !data.neglected) return "Not enough DWS data yet. Rate your focus after each session and I'll identify your weak spots within a week.";
    const parts = [];
    if (data.weakest) parts.push(`Your lowest focus quality is in **${data.weakest.name}** (avg DWS ${data.weakest.avg.toFixed(1)}/5).`);
    if (data.neglected) parts.push(`You've also been neglecting **${data.neglected.name}** this week.`);
    parts.push("Study these subjects at the start of your session, not the end.");
    return parts.join(" ");
  }

  if (q.includes("exam") || q.includes("ready") || q.includes("prepared")) {
    if (!data.urgentExams.length) return "No exams in the next 30 days. Use this time to build deep understanding rather than cramming.";
    const exam = data.urgentExams[0];
    if (exam.daysLeft <= 7) return `**${exam.name}** is in ${exam.daysLeft} days — you're in the critical window. Switch entirely to active recall: past papers, flashcards, teach-it-back. No new content.`;
    if (exam.daysLeft <= 21) return `**${exam.name}** is in ${exam.daysLeft} days. Balance new content (40%) with review (60%) this week. Start past papers now, not the week before.`;
    return `**${exam.name}** is in ${exam.daysLeft} days. Still time to build solid foundations. Focus on understanding over memorisation at this stage.`;
  }

  if (q.includes("focus") || q.includes("dws") || q.includes("deep work")) {
    if (data.currentDws === null) return "No DWS data this week yet. Add a Deep Work Score (1–5) after each session and I'll track your focus quality.";
    const quality = data.currentDws >= 4 ? "excellent" : data.currentDws >= 3 ? "decent" : "below average";
    const tip = data.currentDws < 3
      ? "Try the Pomodoro technique: 25 minutes fully focused, 5-minute break. Remove your phone from the room."
      : "Maintain the same environment and start time — your brain is associating those cues with focus.";
    return `Your average DWS this week is **${data.currentDws.toFixed(1)}/5** — ${quality}. ${tip}`;
  }

  if (q.includes("pattern") || q.includes("habit") || q.includes("time")) {
    if (!data.hasData) return "Log a few sessions first — I need at least 3 to identify patterns.";
    const parts = [];
    if (data.bestTime) parts.push(`You study most in the **${data.bestTime.toLowerCase()}**.`);
    parts.push(`Your current streak is **${data.currentStreak} day${data.currentStreak !== 1 ? "s" : ""}**.`);
    parts.push(`You've logged **${data.totalHours.toFixed(1)} total hours** across ${data.sessionCount} sessions.`);
    if (data.bestTime) parts.push(`Schedule your hardest subject during your ${data.bestTime.toLowerCase()} window.`);
    return parts.join(" ");
  }

  return "I can answer: what to study today, your consistency, weakest areas, exam readiness, focus quality, or study patterns. Ask any of those!";
}
