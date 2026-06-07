import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import { useState } from 'react';

function App() {
  const [ token, setToken ] = useState(localStorage.getItem('token'))

  return(
    <Routes>
      <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />

      <Route path="/login" element={<Login setToken={setToken} />}/>

      <Route path="/register" element={<Register />}/>

      <Route path="/dashboard" element={token ? <Dashboard setToken={setToken} /> : <Navigate to="/login?loggedOut=true"/>}/>
    </Routes>
  )
}

export default App
