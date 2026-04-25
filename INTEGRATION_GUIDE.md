# Study Tracker + AI Coach Integration Guide

## ✅ What Was Integrated

Your StudyCoach system has been fully integrated into your App. Here's what changed:

### 1. **Data Structure Updated**
- Old format: `{ subject, hours }`
- New format: `{ date, subject, durationMinutes, dws, notes }`
  - `date`: YYYY-MM-DD (auto-set to today)
  - `durationMinutes`: converted from hours
  - `dws`: Deep Work Score (1-5, optional)
  - `notes`: Session notes (optional)

### 2. **Storage Keys Aligned**
- Changed from `studySessions` → `studyTracker_sessions`
- Ready for `studyTracker_exams` and `studyTracker_subjects`

### 3. **Navigation Added**
- Main app now has "AI Coach ✦" button
- Click it to view the AI coach powered by Claude
- "← Back to Tracker" button returns you to the tracker

### 4. **Input Fields Enhanced**
- **Subject**: Study topic
- **Hours**: Duration of study
- **Deep Work Score** (1-5): Rate your focus/quality (optional)
- **Notes**: What did you work on? (optional)

### 5. **API Integration Ready**
- Uses Claude Sonnet 4 as your study coach
- 5 messages per day limit (free tier)
- Analyzes your study patterns automatically

---

## 🔑 Setup: Add Your Claude API Key

### Step 1: Get an API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Create an API key

### Step 2: Add to Your Project
1. In project root, rename `.env.example` to `.env`
2. Add your API key:
   ```
   VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
   ```
3. **Never commit `.env` to git!** (Already in .gitignore)

### Step 3: Restart Dev Server
```bash
npm run dev
```

---

## 📊 How to Use the AI Coach

### Smart Analysis
The coach analyzes:
- ✓ Total hours by subject
- ✓ Study consistency (streak)
- ✓ Deep Work Scores (quality metrics)
- ✓ Subjects you're neglecting
- ✓ Exam preparation status

### Example Prompts
- "What should I focus on this week?"
- "Why am I struggling with my weakest subject?"
- "Build me a study plan for my next exam"
- "How's my consistency lately? Be honest."

### Rate Limits
- 5 messages per day per user
- Resets daily at midnight (UTC)
- Stored in localStorage per device

---

## 📝 Optional: Add Exams (For Better Coaching)

Edit `App.jsx` and add this to your state:

```javascript
const [exams, setExams] = useState([]);

useEffect(() => {
  localStorage.setItem("studyTracker_exams", JSON.stringify(exams));
}, [exams]);
```

Add a form to create exams:
```javascript
{
  name: "JEE Advanced",
  subject: "Mathematics",
  date: "2025-05-20"
}
```

The coach will then:
- Prioritize exam-heavy subjects
- Calculate days until each exam
- Suggest focus areas per exam

---

## 🔧 Troubleshooting

### "API key not configured"
- ✓ Did you create `.env` file?
- ✓ Is the key spelled correctly?
- ✓ Did you restart `npm run dev`?

### Coach says "Daily limit reached"
- You've used 5 messages today
- Come back tomorrow (resets at midnight UTC)
- Check localStorage: `study_coach_usage`

### Old sessions not showing
- Your old data used different format
- You'll need to re-enter sessions with the timer or form
- Or manually add them with date/DWS info

---

## 🎯 Next Steps

1. **Get an API key** (5 min)
2. **Add to `.env`** file
3. **Restart dev server**
4. **Log study sessions** with focus scores
5. **Talk to your coach!** Click "AI Coach ✦"

---

## 📚 Files Modified

- `src/App.jsx` - Data structure, navigation, new UI fields
- `src/hooks/useStudyCoach.js` - API key parameter added
- `src/components/CoachPage.jsx` - Aligned storage keys, API key passing
- `src/components/StudyCoach.jsx` - API key prop added

All components are production-ready!
