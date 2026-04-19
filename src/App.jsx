import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

function App() {
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("");
  const [sessions, setSessions] = useState([]);

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

  // TOTAL HOURS
  const totalHours = sessions.reduce((sum, session) => {
    return sum + session.hours;
  }, 0);

  // GROUP DATA
  const subjectData = [];

  sessions.forEach((session) => {
    const existing = subjectData.find(
      (item) => item.name === session.subject
    );

    if (existing) {
      existing.value += session.hours;
    } else {
      subjectData.push({
        name: session.subject,
        value: session.hours,
      });
    }
  });

  // ADD PERCENTAGE
  subjectData.forEach((item) => {
    item.percentage = totalHours
      ? ((item.value / totalHours) * 100).toFixed(1)
      : 0;
  });

  // DAILY SCORE
  const score = Math.min((totalHours / 6) * 100, 100).toFixed(0);

  const getFeedback = () => {
    if (score >= 80) return "🔥 Great job!";
    if (score >= 50) return "👍 Good effort";
    return "⚠️ Need more focus";
  };

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-[350px] text-center">

        <h1 className="text-2xl font-bold mb-4">
          Study Tracker 📚
        </h1>

        {/* INPUT FORM */}
        <input
          type="text"
          placeholder="Enter Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full mb-3 p-2 border rounded-lg"
        />

        <input
          type="number"
          placeholder="Hours Studied"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-full mb-3 p-2 border rounded-lg"
        />

        <button
          onClick={handleAdd}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
        >
          Add Study Session
        </button>

        {/* TOTAL + SCORE */}
        <div className="mt-4 text-lg font-semibold">
          Total: {totalHours} hrs
        </div>

        <div className="text-xl font-bold text-green-600">
          Score: {score}%
        </div>

        <div className="text-sm text-gray-600 mb-4">
          {getFeedback()}
        </div>

        {/* PIE CHART */}
        <div className="flex justify-center">
          <PieChart width={280} height={280}>
            <Pie
              data={subjectData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              label
            >
              {subjectData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>

        {/* PERCENT LIST */}
        <div className="mt-4">
          {subjectData.map((item, index) => (
            <div
              key={index}
              className="bg-gray-100 p-2 mb-2 rounded-lg flex justify-between"
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