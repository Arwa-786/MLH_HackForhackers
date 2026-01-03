import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HackathonList from './pages/HackathonList';
import MatchingPage from './pages/MatchingPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HackathonList />} />
        <Route path="/matching/:hackathonId" element={<MatchingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
