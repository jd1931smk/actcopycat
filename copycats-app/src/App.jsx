import { useEffect, useState } from 'react';
import KaTeXRender from './KaTeXRender';

const themes = {
  default: 'default.css',
  mobile: 'mobile.css',
  classroom: 'classroom.css',
  adhd: 'adhd.css',
};

const App = () => {
  const [theme, setTheme] = useState('default');
  const [testNumbers] = useState([
    "16MC2", "1MC", "2MC", "3MC", "4MC", "52C", "54D", "55C", "56A", "56B",
    "57B", "58E", "59C", "59F", "5MC", "60E", "61B", "61C", "61D", "61E",
    "62D", "63C", "63D", "63E", "63F", "64E", "65B", "65C", "65D", "65E", "65F",
    "66C", "66F", "67A", "67B", "67C", "67F", "68A", "68C", "68G", "69A", "69F",
    "70A", "70B", "70C", "70G", "71A", "71C", "71E", "71G", "71H", "72C", "72E",
    "72F", "72G", "73C", "73E", "73G", "74C", "74F", "74H", "A10", "A11", "A9",
    "B02", "B04", "B05", "C01", "C02", "C03-2", "D03", "D06", "F12", "H31",
    "Red Book 1", "Red Book 2", "Red Book 3", "SATX", "SHMM1", "SHMM2", "SHMM3",
    "SHMM4", "SHMM5", "SHMM6", "SHMM7", "SHMM8", "SHMM9", "Z04", "Z15"
  ]);
  const [selectedTest, setSelectedTest] = useState('');
  const [questionNumbers] = useState(Array.from({length: 60}, (_, i) => i + 1));
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [questionData, setQuestionData] = useState(null);
  const [clones, setClones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ktexFlag, setKtexFlag] = useState(false);

  useEffect(() => {
    const existing = document.getElementById('theme-stylesheet');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.id = 'theme-stylesheet';
    link.rel = 'stylesheet';
    link.href = themes[theme];
    document.head.appendChild(link);
  }, [theme]);

  const fetchQuestion = async () => {
    if (!selectedTest || !selectedQuestion) return;
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/airtable?action=getQuestionDetails&testNumber=${selectedTest}&questionNumber=${selectedQuestion}`);
      if (!res.ok) {
        throw new Error('Failed to fetch question details');
      }
      const data = await res.json();
      console.log('Question data:', data); // Debug log
      let content = data.katex;
      console.log('Raw KatexMarkdown:', JSON.stringify(content)); // See exactly what's being rendered
      content = content.replace(/\r/g, ''); // Remove carriage returns
      setQuestionData({
        ...data,
        testNumber: selectedTest,
        questionNumber: selectedQuestion
      });
      // Update KTEX flag state from the database value
      setKtexFlag(data.KTEX_flag === true || data.KTEX_flag === 'X' || data['KTEX flag'] === true || data['KTEX flag'] === 'X');
      fetchCloneQuestions();
    } catch (err) {
      console.error('Error fetching question:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCloneQuestions = async () => {
    try {
      const res = await fetch(`/.netlify/functions/airtable?action=getCloneQuestions&testNumber=${selectedTest}&questionNumber=${selectedQuestion}`);
      const data = await res.json();
      setClones(data);
    } catch (err) {
      console.error('Error fetching clone questions:', err);
    }
  };

  const handleKtexFlagChange = async (event) => {
    const newFlag = event.target.checked ? 'X' : '';
    console.log('Updating KTEX flag:', {
      testNumber: questionData.testNumber,
      questionNumber: questionData.questionNumber,
      newFlag
    });

    try {
      const response = await fetch(
        `/.netlify/functions/airtable?action=updateKtexFlag&testNumber=${questionData.testNumber}&questionNumber=${questionData.questionNumber}&flag=${newFlag}`
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update KTEX flag');
      }

      console.log('Update response:', data);
      
      // Update local state with the new value from the server
      setKtexFlag(data.newValue === true || data.newValue === 'X');
      
      // Also update the questionData state
      setQuestionData(prev => ({
        ...prev,
        'KTEX flag': data.newValue === true || data.newValue === 'X'
      }));
    } catch (error) {
      console.error('Error updating KTEX flag:', error);
      alert(`Failed to update KTEX flag: ${error.message}`);
    }
  };

  const navigateQuestion = (direction) => {
    const currentIndex = questionNumbers.indexOf(parseInt(selectedQuestion));
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < questionNumbers.length) {
      const newQuestion = questionNumbers[newIndex];
      setSelectedQuestion(newQuestion.toString());
      fetchQuestion();
    }
  };

  return (
    <div className="container">
      <nav className="nav-links">
        <a href='/'>Home</a>
        <a href='/worksheet'>Generate Worksheet</a>
        <a href='/explain'>Explain Questions</a>
      </nav>

      <div className="theme-switcher">
        <label>Theme: </label>
        <select value={theme} onChange={e => setTheme(e.target.value)}>
          <option value="default">Default</option>
          <option value="mobile">Mobile First</option>
          <option value="classroom">Classroom First</option>
          <option value="adhd">ADHD Friendly</option>
        </select>
      </div>

      <h1>ACT Math Question Viewer</h1>

      <div className="selection-area">
        <div className="form-group">
          <label>Test Number:</label>
          <select onChange={(e) => {
            const val = e.target.value;
            setSelectedTest(val);
            setSelectedQuestion('');
          }}>
            <option value="">Select a test number</option>
            {testNumbers.map(tn => <option key={tn} value={tn}>{tn}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Question Number:</label>
          <select onChange={(e) => setSelectedQuestion(e.target.value)}>
            <option value="">Select a question number</option>
            {questionNumbers.map(qn => <option key={qn} value={qn}>{qn}</option>)}
          </select>
        </div>
        <button onClick={fetchQuestion} disabled={!selectedTest || !selectedQuestion}>Fetch and Render</button>
      </div>

      {loading && <div id="spinner"></div>}

      {questionData && (
        <div className="section">
          <div className="question-content">
            <KaTeXRender latex={questionData.katex} />
          </div>
          <div className="ktex-flag-container" style={{
            margin: '20px 0',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            border: '2px solid #ddd',
            borderRadius: '8px',
            width: 'fit-content'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#333',
              fontWeight: '500'
            }}>
              <input
                type="checkbox"
                checked={ktexFlag}
                onChange={handleKtexFlagChange}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              KTEX Flag
            </label>
          </div>
          <div className="nav-buttons" style={{
            display: 'flex',
            gap: '10px',
            marginTop: '20px'
          }}>
            <button 
              onClick={() => navigateQuestion('prev')}
              disabled={questionNumbers.indexOf(parseInt(selectedQuestion)) <= 0}
            >
              Previous
            </button>
            <button 
              onClick={() => navigateQuestion('next')}
              disabled={questionNumbers.indexOf(parseInt(selectedQuestion)) >= questionNumbers.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {clones.length > 0 && (
        <div className="section">
          <h2>Clone Questions</h2>
          {clones.map((clone, index) => (
            <div key={index} className="clone-question">
              <KaTeXRender latex={clone.clone} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;