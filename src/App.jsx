import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SmartCoach from "./components/SmartCoach";

const SESSION_STORAGE_KEY = "studyTracker_sessions";
const REVIEW_STORAGE_KEY = "studyTracker_reviews";
const EXAM_STORAGE_KEY = "studyTracker_exams";
const COLORS = ["#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MASTERY_POINTS_PER_HOUR = 4;

function toDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function formatShortDate(dateKey) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${dateKey}T00:00:00`),
  );
}

function daysBetween(fromKey, toKey) {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to - from) / MS_PER_DAY);
}

function startOfWeek(dateKey = toDateKey()) {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function isWithinRange(dateKey, startKey, endKey) {
  return dateKey >= startKey && dateKey <= endKey;
}

function hoursForSessions(items) {
  return items.reduce((sum, session) => sum + session.durationMinutes / 60, 0);
}

function subjectTotals(items) {
  return items.reduce((totals, session) => {
    totals[session.subject] = (totals[session.subject] ?? 0) + session.durationMinutes / 60;
    return totals;
  }, {});
}

function getSessionHour(session) {
  if (Number.isFinite(session.hour)) return session.hour;
  const stamp = session.startedAt ?? session.createdAt;
  if (!stamp) return null;
  const hour = new Date(stamp).getHours();
  return Number.isFinite(hour) ? hour : null;
}

function getTimeBucket(hour) {
  if (hour === null) return null;
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

function average(values) {
  const realValues = values.filter((value) => Number.isFinite(value));
  if (!realValues.length) return null;
  return realValues.reduce((sum, value) => sum + value, 0) / realValues.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function matchesExamSubject(sessionSubject, examSubject) {
  if (!examSubject) return true;
  return sessionSubject.toLowerCase().includes(examSubject.toLowerCase());
}

function getUrgency(daysLeft) {
  if (daysLeft <= 7) return { label: "Critical", color: "#DC2626", bg: "bg-red-50", text: "text-red-700" };
  if (daysLeft <= 21) return { label: "High", color: "#D97706", bg: "bg-amber-50", text: "text-amber-700" };
  if (daysLeft <= 45) return { label: "Rising", color: "#2563EB", bg: "bg-blue-50", text: "text-blue-700" };
  return { label: "Steady", color: "#059669", bg: "bg-emerald-50", text: "text-emerald-700" };
}

function buildExamPlans(exams, sessions, today = toDateKey()) {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  return exams
    .filter((exam) => exam?.name && exam?.date)
    .map((exam, index) => {
      const confidence = clamp(Number(exam.confidence) || 0, 0, 100);
      const targetMastery = clamp(Number(exam.targetMastery) || 85, 1, 100);
      const daysLeft = Math.max(0, daysBetween(today, exam.date));
      const relevantSessions = sessions.filter((session) =>
        matchesExamSubject(session.subject, exam.subject ?? ""),
      );
      const relevantHours = hoursForSessions(relevantSessions);
      const currentWeekHours = hoursForSessions(
        relevantSessions.filter((session) => isWithinRange(session.date, weekStart, weekEnd)),
      );
      const projectedMastery = clamp(
        confidence + relevantHours * MASTERY_POINTS_PER_HOUR,
        0,
        100,
      );
      const masteryGap = Math.max(0, targetMastery - projectedMastery);
      const remainingHours = masteryGap / MASTERY_POINTS_PER_HOUR;
      const weeksLeft = Math.max(daysLeft / 7, 1 / 7);
      const hoursPerWeek = daysLeft === 0 ? remainingHours : remainingHours / weeksLeft;
      const hoursPerDay = daysLeft === 0 ? remainingHours : remainingHours / Math.max(daysLeft, 1);
      const thisWeekTarget = Math.max(0, hoursPerWeek - currentWeekHours);
      const urgency = getUrgency(daysLeft);

      return {
        ...exam,
        id: exam.id ?? `${exam.name}-${exam.date}-${index}`,
        subject: exam.subject ?? "",
        confidence,
        targetMastery,
        daysLeft,
        relevantHours,
        currentWeekHours,
        projectedMastery,
        masteryGap,
        remainingHours,
        hoursPerWeek,
        hoursPerDay,
        thisWeekTarget,
        urgency,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function buildCountdownData(plans) {
  return plans.map((plan) => ({
    name: plan.name,
    daysLeft: plan.daysLeft,
    subject: plan.subject || "All topics",
    fill: plan.urgency.color,
  }));
}

function calculateStreak(items, todayKey = toDateKey()) {
  const studiedDays = new Set(items.map((session) => session.date));
  let streak = 0;
  let cursor = todayKey;

  while (studiedDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function calculateSm2Review(previousReview, quality, studiedOn = toDateKey()) {
  const rating = Math.max(1, Math.min(5, Number(quality)));
  const previousEaseFactor = previousReview?.easeFactor ?? 2.5;
  const nextEaseFactor = Math.max(
    1.3,
    previousEaseFactor +
      (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)),
  );

  let repetitions = previousReview?.repetitions ?? 0;
  let intervalDays = previousReview?.intervalDays ?? 0;

  if (rating < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * nextEaseFactor);
  }

  return {
    topic: previousReview?.topic ?? "",
    easeFactor: Number(nextEaseFactor.toFixed(2)),
    intervalDays,
    repetitions,
    lapses: rating < 3 ? (previousReview?.lapses ?? 0) + 1 : previousReview?.lapses ?? 0,
    lastRating: rating,
    lastStudied: studiedOn,
    nextReview: addDays(studiedOn, intervalDays),
  };
}

function buildTimeline(reviewTopics) {
  const today = toDateKey();

  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);
    const count = reviewTopics.filter((topic) => topic.nextReview === date).length;
    return {
      date,
      label: index === 0 ? "Today" : date.slice(5),
      reviews: count,
    };
  });
}

function readStoredArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? [];
  } catch {
    return [];
  }
}

function buildDwsTrend(weekStart, sessions) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const daySessions = sessions.filter((session) => session.date === date && Number.isFinite(session.dws));
    const avg = average(daySessions.map((session) => session.dws));

    return {
      date,
      label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
      dws: avg ? Number(avg.toFixed(1)) : null,
    };
  });
}

function buildDebrief(sessions, reviewTopics) {
  const today = toDateKey();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(weekStart, -1);
  const currentWeek = sessions.filter((session) => isWithinRange(session.date, weekStart, weekEnd));
  const previousWeek = sessions.filter((session) => isWithinRange(session.date, previousStart, previousEnd));
  const currentSubjects = subjectTotals(currentWeek);
  const previousSubjects = subjectTotals(previousWeek);
  const totalHours = hoursForSessions(currentWeek);
  const previousHours = hoursForSessions(previousWeek);
  const topSubjectEntry = Object.entries(currentSubjects).sort((a, b) => b[1] - a[1])[0];
  const dwsTrend = buildDwsTrend(weekStart, currentWeek);
  const currentDws = average(currentWeek.map((session) => session.dws));
  const previousDws = average(previousWeek.map((session) => session.dws));
  const timeBuckets = currentWeek.reduce((buckets, session) => {
    const bucket = getTimeBucket(getSessionHour(session));
    if (!bucket) return buckets;
    buckets[bucket] = (buckets[bucket] ?? 0) + session.durationMinutes / 60;
    return buckets;
  }, {});
  const bestTimeEntry = Object.entries(timeBuckets).sort((a, b) => b[1] - a[1])[0];
  const upcomingReviews = reviewTopics.filter((topic) => {
    const daysAway = daysBetween(today, topic.nextReview);
    return daysAway >= 0 && daysAway <= 7;
  });

  const subjectDrop = Object.entries(previousSubjects)
    .map(([name, hours]) => {
      const current = currentSubjects[name] ?? 0;
      return {
        name,
        current,
        previous: hours,
        dropPercent: hours > 0 ? ((hours - current) / hours) * 100 : 0,
      };
    })
    .filter((item) => item.dropPercent >= 25)
    .sort((a, b) => b.dropPercent - a.dropPercent)[0];

  const exams = readStoredArray("studyTracker_exams");
  const examSoon = exams
    .map((exam) => ({
      ...exam,
      daysLeft: Math.ceil((new Date(`${exam.date}T00:00:00`) - new Date(`${today}T00:00:00`)) / MS_PER_DAY),
    }))
    .filter((exam) => exam.daysLeft >= 0 && exam.daysLeft <= 21)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const nudges = [];

  if (subjectDrop) {
    nudges.push(
      `You studied ${Math.round(subjectDrop.dropPercent)}% less ${subjectDrop.name} than last week. Put one focused block on the calendar.`,
    );
  }

  if (examSoon) {
    const subject = examSoon.subject ? `${examSoon.subject} ` : "";
    nudges.push(`${subject}${examSoon.name} is in ${examSoon.daysLeft} days. Front-load recall practice this week.`);
  }

  if (upcomingReviews.length > 0) {
    nudges.push(`${upcomingReviews.length} review${upcomingReviews.length > 1 ? "s" : ""} land in the next 7 days. Clear them before adding new topics.`);
  }

  if (currentDws !== null && previousDws !== null) {
    const delta = currentDws - previousDws;
    nudges.push(
      delta >= 0
        ? `DWS is up ${delta.toFixed(1)} points from last week. Keep the same study environment.`
        : `DWS dipped ${Math.abs(delta).toFixed(1)} points. Use shorter blocks and remove one distraction trigger.`,
    );
  }

  if (totalHours < previousHours && previousHours > 0) {
    const drop = Math.round(((previousHours - totalHours) / previousHours) * 100);
    nudges.push(`Total study time is down ${drop}% week over week. Add a recovery session before Sunday.`);
  }

  if (nudges.length < 3) {
    nudges.push("Schedule your hardest topic during your best time window next week.");
  }
  if (nudges.length < 3) {
    nudges.push("Turn one weak note into active recall questions before your next session.");
  }
  if (nudges.length < 3) {
    nudges.push("Keep one review-only block so spaced repetition does not crowd new learning.");
  }

  return {
    weekStart,
    weekEnd,
    totalHours,
    previousHours,
    topSubject: topSubjectEntry?.[0] ?? "No sessions yet",
    topSubjectHours: topSubjectEntry?.[1] ?? 0,
    bestTime: bestTimeEntry?.[0] ?? "Not enough timed data",
    bestTimeHours: bestTimeEntry?.[1] ?? 0,
    streak: calculateStreak(sessions, today),
    currentDws,
    previousDws,
    dwsTrend,
    nudges: nudges.slice(0, 3),
  };
}

function App() {
  const debriefRef = useRef(null);
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("");
  const [retention, setRetention] = useState("4");
  const [sessions, setSessions] = useState(() => readStoredArray(SESSION_STORAGE_KEY));
  const [reviewTopics, setReviewTopics] = useState(() => readStoredArray(REVIEW_STORAGE_KEY));
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [page, setPage] = useState("tracker");
  const [dws, setDws] = useState("");
  const [notes, setNotes] = useState("");
  const [exams, setExams] = useState(() => readStoredArray(EXAM_STORAGE_KEY));
  const [examName, setExamName] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examConfidence, setExamConfidence] = useState("45");
  const [examTargetMastery, setExamTargetMastery] = useState("85");

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewTopics));
  }, [reviewTopics]);

  useEffect(() => {
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const updateReviewSchedule = (topic, rating, studiedOn = toDateKey()) => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    setReviewTopics((previous) => {
      const current = previous.find(
        (item) => item.topic.toLowerCase() === cleanTopic.toLowerCase(),
      );
      const next = {
        ...calculateSm2Review(current, rating, studiedOn),
        topic: current?.topic ?? cleanTopic,
      };

      if (!current) return [...previous, next];
      return previous.map((item) => (item.topic === current.topic ? next : item));
    });
  };

  const resetForm = () => {
    setSubject("");
    setHours("");
    setRetention("4");
    setDws("");
    setNotes("");
  };

  const resetExamForm = () => {
    setExamName("");
    setExamSubject("");
    setExamDate("");
    setExamConfidence("45");
    setExamTargetMastery("85");
  };

  const buildSession = (durationMinutes, startedAt = new Date().toISOString()) => ({
    date: toDateKey(new Date(startedAt)),
    subject: subject.trim(),
    durationMinutes,
    retention: Number(retention),
    dws: dws ? parseFloat(dws) : null,
    notes: notes.trim() || null,
    startedAt,
    completedAt: new Date().toISOString(),
    hour: new Date(startedAt).getHours(),
  });

  const handleAdd = () => {
    if (!subject.trim() || !hours) {
      alert("Please fill in topic and hours");
      return;
    }

    const durationMinutes = Math.round(parseFloat(hours) * 60);
    if (!durationMinutes || durationMinutes < 1) {
      alert("Hours studied must be greater than 0");
      return;
    }

    const newSession = buildSession(durationMinutes);

    if (editIndex !== null) {
      const updated = [...sessions];
      updated[editIndex] = newSession;
      setSessions(updated);
      setEditIndex(null);
    } else {
      setSessions([...sessions, newSession]);
    }

    updateReviewSchedule(newSession.subject, newSession.retention, newSession.date);
    resetForm();
  };

  const startTimer = () => {
    if (!subject.trim()) {
      alert("Enter topic before starting timer");
      return;
    }
    setTimerStartedAt(new Date().toISOString());
    setIsRunning(true);
  };

  const stopTimer = () => {
    setIsRunning(false);

    const durationMinutes = Math.round(seconds / 60);
    if (durationMinutes > 0) {
      const session = buildSession(durationMinutes, timerStartedAt ?? new Date().toISOString());
      setSessions((previous) => [...previous, session]);
      updateReviewSchedule(session.subject, session.retention, session.date);
    }

    setSeconds(0);
    setTimerStartedAt(null);
    resetForm();
  };

  const handleDelete = (index) => {
    if (!confirm("Delete this session?")) return;
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const handleEdit = (index) => {
    const session = sessions[index];
    setSubject(session.subject);
    setHours((session.durationMinutes / 60).toFixed(2));
    setRetention(String(session.retention ?? 4));
    setDws(session.dws || "");
    setNotes(session.notes || "");
    setEditIndex(index);
  };

  const handleAddExam = () => {
    if (!examName.trim() || !examDate) {
      alert("Please add an exam name and date");
      return;
    }

    const confidence = clamp(Number(examConfidence), 0, 100);
    const targetMastery = clamp(Number(examTargetMastery), 1, 100);

    if (confidence >= targetMastery) {
      alert("Target mastery should be higher than current confidence");
      return;
    }

    setExams((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: examName.trim(),
        subject: examSubject.trim(),
        date: examDate,
        confidence,
        targetMastery,
        createdAt: new Date().toISOString(),
      },
    ]);
    resetExamForm();
  };

  const handleDeleteExam = (examId) => {
    if (!confirm("Delete this exam plan?")) return;
    setExams((previous) => previous.filter((exam) => exam.id !== examId));
  };

  const markReviewed = (topic, rating) => {
    updateReviewSchedule(topic, rating);
  };

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = totalMinutes / 60;

  const subjectData = useMemo(() => {
    const totals = sessions.reduce((items, session) => {
      const key = session.subject;
      items[key] = (items[key] ?? 0) + session.durationMinutes / 60;
      return items;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({
      name,
      value,
      percentage: totalHours ? ((value / totalHours) * 100).toFixed(1) : 0,
    }));
  }, [sessions, totalHours]);

  const today = toDateKey();
  const sortedReviews = [...reviewTopics].sort(
    (a, b) => new Date(a.nextReview) - new Date(b.nextReview),
  );
  const dueTopics = sortedReviews.filter((topic) => daysBetween(today, topic.nextReview) <= 0);
  const nearDueTopics = sortedReviews.filter((topic) => {
    const daysAway = daysBetween(today, topic.nextReview);
    return daysAway > 0 && daysAway <= 2;
  });
  const timelineData = buildTimeline(reviewTopics);
  const weeklyDebrief = useMemo(() => buildDebrief(sessions, reviewTopics), [sessions, reviewTopics]);
  const examPlans = useMemo(() => buildExamPlans(exams, sessions, today), [exams, sessions, today]);
  const countdownData = useMemo(() => buildCountdownData(examPlans), [examPlans]);
  const score = Math.min((totalHours / 6) * 100, 100).toFixed(0);

  const exportDebrief = async () => {
    if (!debriefRef.current) return;

    const canvas = await html2canvas(debriefRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `study-debrief-${weeklyDebrief.weekEnd}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (page === "coach") {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => setPage("tracker")}
          className="mb-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          ← Back to Tracker
        </button>
        <SmartCoach
          sessions={sessions}
          exams={exams}
          reviewTopics={reviewTopics}
        />
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <main className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[380px_1fr]">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-normal">Study Tracker</h1>
              <p className="text-sm text-zinc-500">Time tracking plus SM-2 review scheduling.</p>
            </div>
            <button
              onClick={() => setPage("coach")}
              className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              AI Coach
            </button>
          </div>

          <div className="grid gap-3">
            <label className="text-left text-sm font-semibold">
              Topic
              <input
                type="text"
                placeholder="Physics: rotational motion"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-left text-sm font-semibold">
              Hours studied
              <input
                type="number"
                placeholder="1.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
                min="0"
                step="0.25"
              />
            </label>

            <label className="text-left text-sm font-semibold">
              Retention rating: {retention}/5
              <input
                type="range"
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                className="mt-2 w-full accent-blue-600"
                min="1"
                max="5"
                step="1"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                1 = forgot it, 5 = effortless recall
              </span>
            </label>

            <label className="text-left text-sm font-semibold">
              Deep Work Score
              <input
                type="number"
                placeholder="Optional, 1-5"
                value={dws}
                onChange={(e) => setDws(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
                min="1"
                max="5"
                step="0.1"
              />
            </label>

            <textarea
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20 w-full rounded-md border border-zinc-300 p-2 outline-none focus:border-blue-500"
            />

            <button
              onClick={handleAdd}
              className="rounded-md bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
            >
              {editIndex !== null ? "Update Session and Schedule" : "Add Session and Schedule"}
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-lg font-semibold">
              {Math.floor(seconds / 60)}m {seconds % 60}s
            </div>
            {!isRunning ? (
              <button
                onClick={startTimer}
                className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Start Timer
              </button>
            ) : (
              <button
                onClick={stopTimer}
                className="mt-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Stop and Schedule
              </button>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">Exam Countdown</h2>
              <p className="text-sm text-zinc-500">Reverse-plan weekly targets from exam dates.</p>
            </div>

            <div className="grid gap-3">
              <label className="text-left text-sm font-semibold">
                Exam
                <input
                  type="text"
                  placeholder="JEE Main 2026"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-left text-sm font-semibold">
                Subject or topic scope
                <input
                  type="text"
                  placeholder="Physics"
                  value={examSubject}
                  onChange={(e) => setExamSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-left text-sm font-semibold">
                Exam date
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-normal outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-left text-sm font-semibold">
                Current confidence: {examConfidence}%
                <input
                  type="range"
                  value={examConfidence}
                  onChange={(e) => setExamConfidence(e.target.value)}
                  className="mt-2 w-full accent-amber-600"
                  min="0"
                  max="100"
                  step="5"
                />
              </label>

              <label className="text-left text-sm font-semibold">
                Target mastery: {examTargetMastery}%
                <input
                  type="range"
                  value={examTargetMastery}
                  onChange={(e) => setExamTargetMastery(e.target.value)}
                  className="mt-2 w-full accent-emerald-600"
                  min="50"
                  max="100"
                  step="5"
                />
              </label>

              <button
                onClick={handleAddExam}
                className="rounded-md bg-zinc-950 py-2 font-semibold text-white hover:bg-zinc-800"
              >
                Add Exam Plan
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Total study time</p>
              <p className="mt-1 text-3xl font-bold">{totalHours.toFixed(2)}h</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Daily impact score</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">{score}%</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Due today</p>
              <p className="mt-1 text-3xl font-bold text-red-700">{dueTopics.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Countdown Intelligence</h2>
                <p className="text-sm text-zinc-500">
                  Weekly and daily targets rebalance from logged sessions and remaining mastery gap.
                </p>
              </div>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                {examPlans.length} exams
              </span>
            </div>

            {examPlans.length === 0 ? (
              <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
                Add an exam plan to see urgency, target hours, and countdown pacing.
              </p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countdownData} margin={{ top: 8, right: 20, left: -12, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name, item) => [
                          `${value} day${value === 1 ? "" : "s"}`,
                          item.payload.subject,
                        ]}
                      />
                      <Bar dataKey="daysLeft" radius={[6, 6, 0, 0]}>
                        {countdownData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {examPlans.map((plan) => (
                    <div key={plan.id} className={`rounded-md border border-zinc-200 p-3 ${plan.urgency.bg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-xs text-zinc-600">
                            {plan.subject || "All topics"} | {formatShortDate(plan.date)} |{" "}
                            <span className={`font-bold ${plan.urgency.text}`}>{plan.urgency.label}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteExam(plan.id)}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-zinc-500">Days left</p>
                          <p className="text-xl font-bold">{plan.daysLeft}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Need/week</p>
                          <p className="text-xl font-bold">{plan.hoursPerWeek.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Need/day</p>
                          <p className="text-xl font-bold">{plan.hoursPerDay.toFixed(1)}h</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-md bg-white/80 p-2 text-xs text-zinc-600">
                        Mastery {Math.round(plan.projectedMastery)}% / {plan.targetMastery}% after{" "}
                        {plan.relevantHours.toFixed(1)}h logged. This week still needs{" "}
                        <span className="font-bold text-zinc-950">{plan.thisWeekTarget.toFixed(1)}h</span>.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Weekly Debrief</h2>
                <p className="text-sm text-zinc-500">
                  Auto-generated Sunday summary for {formatShortDate(weeklyDebrief.weekStart)} to{" "}
                  {formatShortDate(weeklyDebrief.weekEnd)}.
                </p>
              </div>
              <button
                onClick={exportDebrief}
                className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Export PNG
              </button>
            </div>

            <div
              ref={debriefRef}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-950"
            >
              <div className="grid gap-4 bg-zinc-950 p-5 text-white md:grid-cols-[1fr_260px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Sunday study debrief</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-normal">
                    {weeklyDebrief.totalHours.toFixed(1)} hours logged
                  </h3>
                  <p className="mt-2 text-sm text-zinc-300">
                    Top focus: {weeklyDebrief.topSubject}{" "}
                    {weeklyDebrief.topSubjectHours > 0 && `(${weeklyDebrief.topSubjectHours.toFixed(1)}h)`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-zinc-300">Streak</p>
                    <p className="text-2xl font-bold">{weeklyDebrief.streak}d</p>
                  </div>
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-zinc-300">Avg DWS</p>
                    <p className="text-2xl font-bold">
                      {weeklyDebrief.currentDws === null ? "n/a" : weeklyDebrief.currentDws.toFixed(1)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-md bg-white/10 p-3">
                    <p className="text-zinc-300">Best time of day</p>
                    <p className="text-xl font-bold">{weeklyDebrief.bestTime}</p>
                    {weeklyDebrief.bestTimeHours > 0 && (
                      <p className="text-xs text-zinc-300">{weeklyDebrief.bestTimeHours.toFixed(1)}h studied there</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[280px_1fr]">
                <div>
                  <p className="text-sm font-bold">DWS trend</p>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyDebrief.dwsTrend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="dws"
                          stroke="#059669"
                          strokeWidth={3}
                          fill="#D1FAE5"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold">Next-week nudges</p>
                  <div className="mt-2 grid gap-2">
                    {weeklyDebrief.nudges.map((nudge, index) => (
                      <div key={nudge} className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                        <span className="mr-2 font-bold text-blue-700">{index + 1}.</span>
                        {nudge}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500">
                <span>
                  Week over week:{" "}
                  {weeklyDebrief.previousHours > 0
                    ? `${Math.round(((weeklyDebrief.totalHours - weeklyDebrief.previousHours) / weeklyDebrief.previousHours) * 100)}%`
                    : "new baseline"}
                </span>
                <span>Generated by Study Tracker</span>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Upcoming Reviews</h2>
                  <p className="text-sm text-zinc-500">Next 14 days from SM-2 intervals.</p>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                  {reviewTopics.length} topics
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reviews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="reviews"
                      stroke="#2563EB"
                      strokeWidth={3}
                      fill="url(#reviews)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Due Today</h2>
              <p className="mb-3 text-sm text-zinc-500">Rate recall after review to schedule the next date.</p>
              <div className="grid max-h-72 gap-2 overflow-y-auto">
                {[...dueTopics, ...nearDueTopics].length === 0 ? (
                  <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">No reviews due yet.</p>
                ) : (
                  [...dueTopics, ...nearDueTopics].map((topic) => {
                    const daysAway = daysBetween(today, topic.nextReview);
                    return (
                      <div key={topic.topic} className="rounded-md border border-zinc-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{topic.topic}</p>
                            <p className="text-xs text-zinc-500">
                              {daysAway <= 0 ? "Due now" : `Due in ${daysAway} day${daysAway > 1 ? "s" : ""}`} |
                              interval {topic.intervalDays}d | EF {topic.easeFactor}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => markReviewed(topic.topic, rating)}
                              className="rounded-md border border-zinc-200 py-1 text-xs font-semibold hover:border-blue-500 hover:bg-blue-50"
                              title={`Rate ${rating}/5`}
                            >
                              {rating}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">Time by Topic</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={95}
                    >
                      {subjectData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-bold">Sessions</h2>
              <div className="grid max-h-80 gap-2 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">Add your first study session.</p>
                ) : (
                  sessions.map((session, index) => (
                    <div key={`${session.date}-${session.subject}-${index}`} className="rounded-md bg-zinc-50 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{session.subject}</p>
                          <p className="text-xs text-zinc-500">
                            {session.date} | {(session.durationMinutes / 60).toFixed(2)}h | retention{" "}
                            {session.retention ?? "n/a"}/5 | DWS {session.dws || "n/a"}
                          </p>
                          {session.notes && <p className="mt-1 text-xs text-zinc-600">{session.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(index)}
                            className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
