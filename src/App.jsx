import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

function App() {
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("");
  const [sessions, setSessions] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("studySessions");
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("studySessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleAdd = () => {
    if (!subject || !hours) {
      alert("Please fill all fields");
      return;
    }

    const newSession = {
      subject,
      hours: parseFloat(hours),
    };

    setSessions([...sessions, newSession]);
    setSubject("");
    setHours("");
  };

  const startTimer = () => {
    if (!subject) {
      alert("Enter subject before starting timer");
      return;
    }
    setIsRunning(true);
  };

  const stopTimer = () => {
    setIsRunning(false);

    const hrs = (seconds / 3600).toFixed(2);

    if (hrs > 0) {
      const newSession = {
        subject,
        hours: parseFloat(hrs),
      };
      setSessions([...sessions, newSession]);
    }

    setSeconds(0);
  };

  const handleDelete = (index) => {
    if (!confirm("Delete this session?")) return;
    const updated = sessions.filter((_, i) => i !== index);
    setSessions(updated);
  };

  const handleEdit = (index) => {
    const session = sessions[index];
    setSubject(session.subject);
    setHours(session.hours);
    handleDelete(index);
  };

  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);

  const subjectData = [];
  sessions.forEach((s) => {
    const existing = subjectData.find((i) => i.name === s.subject);
    if (existing) existing.value += s.hours;
    else subjectData.push({ name: s.subject, value: s.hours });
  });

  subjectData.forEach((i) => {
    i.percentage = totalHours
      ? ((i.value / totalHours) * 100).toFixed(1)
      : 0;
  });

  const score = Math.min((totalHours / 6) * 100, 100).toFixed(0);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-[350px] text-center">

        <h1 className="text-2xl font-bold mb-4">Study Tracker 📚</h1>

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
        />

        <button
          onClick={handleAdd}
          className="w-full bg-blue-500 text-white py-2 rounded-lg mb-2"
        >
          Add Manually
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

        <div className="text-lg font-semibold">
          Total: {totalHours.toFixed(2)} hrs
        </div>

        <div className="text-green-600 font-bold">
          Score: {score}%
        </div>

        {/* PIE CHART */}
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

        {/* SESSION LIST */}
        <div className="mt-4">
          <h2 className="font-semibold mb-2">Sessions</h2>

          {sessions.map((session, index) => (
            <div
              key={index}
              className="bg-gray-100 p-2 mb-2 rounded-lg flex justify-between items-center"
            >
              <div>
                {session.subject} - {session.hours} hrs
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleEdit(index)}
                  className="text-blue-500 text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(index)}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* PERCENT LIST */}
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