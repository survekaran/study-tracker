import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import CoachPage from "./components/CoachPage";

function App() {
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("");
  const [sessions, setSessions] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [editIndex, setEditIndex] = useState(null);
  const [page, setPage] = useState("tracker"); // "tracker" or "coach"
  const [dws, setDws] = useState(""); // Deep Work Score
  const [notes, setNotes] = useState("");

  // LOAD
  useEffect(() => {
    const saved = localStorage.getItem("studyTracker_sessions");
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  // SAVE
  useEffect(() => {
    localStorage.setItem("studyTracker_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // TIMER
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // ADD / UPDATE
  const handleAdd = () => {
    if (!subject || !hours) {
      alert("Please fill in subject and hours");
      return;
    }

    const newSession = {
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      subject: subject.trim(),
      durationMinutes: Math.round(parseFloat(hours) * 60), // Convert hours to minutes
      dws: dws ? parseFloat(dws) : null, // Deep Work Score (1-5)
      notes: notes.trim() || null,
    };

    if (editIndex !== null) {
      const updated = [...sessions];
      updated[editIndex] = newSession;
      setSessions(updated);
      setEditIndex(null);
    } else {
      setSessions([...sessions, newSession]);
    }

    setSubject("");
    setHours("");
    setDws("");
    setNotes("");
  };

  // TIMER START
  const startTimer = () => {
    if (!subject.trim()) {
      alert("Enter subject before starting timer");
      return;
    }
    setIsRunning(true);
  };

  // TIMER STOP
  const stopTimer = () => {
    setIsRunning(false);

    setSessions((prev) => {
      const durationMinutes = Math.round(seconds / 60);

      if (durationMinutes > 0) {
        return [
          ...prev,
          {
            date: new Date().toISOString().slice(0, 10),
            subject: subject.trim(),
            durationMinutes,
            dws: dws ? parseFloat(dws) : null,
            notes: notes.trim() || null,
          },
        ];
      }
      return prev;
    });

    setSeconds(0);
    setSubject("");
    setDws("");
    setNotes("");
  };

  // DELETE
  const handleDelete = (index) => {
    if (!confirm("Delete this session?")) return;
    setSessions(sessions.filter((_, i) => i !== index));
  };

  // EDIT
  const handleEdit = (index) => {
    const session = sessions[index];
    setSubject(session.subject);
    setHours((session.durationMinutes / 60).toFixed(2));
    setDws(session.dws || "");
    setNotes(session.notes || "");
    setEditIndex(index);
  };

  // CALCULATIONS
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = totalMinutes / 60;

  const subjectData = [];
  sessions.forEach((s) => {
    const existing = subjectData.find((i) => i.name === s.subject);
    const hours = s.durationMinutes / 60;
    if (existing) existing.value += hours;
    else subjectData.push({ name: s.subject, value: hours });
  });

  subjectData.forEach((i) => {
    i.percentage = totalHours
      ? ((i.value / totalHours) * 100).toFixed(1)
      : 0;
  });

  const score = Math.min((totalHours / 6) * 100, 100).toFixed(0);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  // Show CoachPage if user navigates to it
  if (page === "coach") {
    return (
      <div>
        <button
          onClick={() => setPage("tracker")}
          className="fixed top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          ← Back to Tracker
        </button>
        <CoachPage sessions={sessions} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-[400px] text-center">

        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Study Tracker 📚</h1>
          <button
            onClick={() => setPage("coach")}
            className="bg-purple-500 text-white px-3 py-1 rounded text-sm"
          >
            AI Coach ✦
          </button>
        </div>

        {/* INPUT */}
        <input
          type="text"
          placeholder="Enter Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full mb-2 p-2 border rounded-lg"
        />

        <input
          type="number"
          placeholder="Hours Studied"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-full mb-2 p-2 border rounded-lg"
          step="0.5"
        />

        <input
          type="number"
          placeholder="Deep Work Score (1-5)"
          value={dws}
          onChange={(e) => setDws(e.target.value)}
          className="w-full mb-2 p-2 border rounded-lg"
          min="1"
          max="5"
          step="0.1"
        />

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mb-2 p-2 border rounded-lg"
          rows="2"
        />

        <button
          onClick={handleAdd}
          className="w-full bg-blue-500 text-white py-2 rounded-lg mb-2"
        >
          {editIndex !== null ? "Update Session" : "Add Manually"}
        </button>

        {/* TIMER */}
        <div className="mb-3">
          <div className="text-lg font-semibold">
            ⏱ {Math.floor(seconds / 60)}m {seconds % 60}s
          </div>

          {!isRunning ? (
            <button
              onClick={startTimer}
              className="bg-green-500 text-white px-4 py-1 rounded mt-2"
            >
              Start
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="bg-red-500 text-white px-4 py-1 rounded mt-2"
            >
              Stop
            </button>
          )}
        </div>

        {/* STATS */}
        <div className="text-lg font-semibold">
          Total: {totalHours.toFixed(2)} hrs
        </div>

        <div className="text-green-600 font-bold">
          Score: {score}%
        </div>

        {/* CHART */}
        <PieChart width={280} height={280}>
          <Pie
            data={subjectData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
          >
            {subjectData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>

        {/* SESSIONS */}
        <div className="mt-4 max-h-[300px] overflow-y-auto">
          <h2 className="font-semibold mb-2">Sessions</h2>

          {sessions.map((session, index) => (
            <div
              key={index}
              className="bg-gray-100 p-2 mb-2 rounded-lg text-sm"
            >
              <div className="text-left mb-1">
                <strong>{session.subject}</strong> • {session.date}
              </div>
              <div className="text-left text-xs text-gray-600 mb-1">
                {(session.durationMinutes / 60).toFixed(2)}h | DWS: {session.dws || "—"} | {session.notes || "no notes"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(index)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* PERCENT */}
        <div className="mt-3">
          {subjectData.map((item, i) => (
            <div
              key={i}
              className="flex justify-between bg-gray-100 p-2 mb-1 rounded"
            >
              <span>{item.name}</span>
              <span>{item.percentage}%</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;