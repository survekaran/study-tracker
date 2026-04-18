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

  const totalHours = sessions.reduce((sum, session) => {
    return sum + session.hours;
  }, 0);

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
  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-6">Study Tracker 📚</h1>

      <div className="bg-white p-6 rounded-2xl shadow-md w-80">
        <input
          type="text"
          placeholder="Enter Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full mb-4 p-2 border rounded-lg"
        />

        <input
          type="number"
          placeholder="Hours Studied"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-full mb-4 p-2 border rounded-lg"
        />

        <button
          onClick={handleAdd}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
        >
          Add Study Session
        </button>
      </div>

      <div className="mt-6 w-80">
        {sessions.map((session, index) => (
          <div
            key={index}
            className="bg-white p-3 mb-2 rounded-lg shadow"
          >
            {session.subject} - {session.hours} hrs
          </div>
        ))}
      </div>
      <div className="mt-4 text-lg font-semibold">
        Total Study Time: {totalHours} hrs
      </div>

      <div className="mt-6 flex justify-center">
        <PieChart width={300} height={300}>
          <Pie
            data={subjectData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            label
          >
            {subjectData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </div>
    </div>
  );
}

export default App;