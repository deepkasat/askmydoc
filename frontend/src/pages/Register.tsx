import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {

 const [username, setUsername] = useState('')
 const [password, setPassword] = useState('')
 const [error, setError] = useState('')
 const [loading, setLoading] = useState(false)
 const navigate = useNavigate()

 const handleRegister = async () => {

  setLoading(true)

  setError('')

  try {
   await axios.post('http://13.206.88.177:8000/register', { username, password })
   navigate('/login?registered=true')
  } catch (err: any) {
   if(!err.response) {
    setError('Server unavailable. Please try again lateror make sure the backend server is running.')
   } else {
    setError(err.response?.data?.detail || 'Registration Failed. Please try again.')
   }
  }
  setLoading(false)
 }

 return(

  <div style={styles.container}>

   <div style={styles.card}>

    <h1 style={styles.title}>Smart Doc Reviewer</h1>

    <p style={styles.subtitle}>create your Account</p>

    { error && <div style={styles.error}>{error}</div>}

    <input
     style={styles.input}
     placeholder="Username"
     value={username}
     onChange={e => setUsername(e.target.value)}
    />

    <input
     style={styles.input}
     placeholder="Password"
     type="password"
     value={password}
     onChange={e => setPassword(e.target.value)}
    />

    <button
     style={styles.button}
     onClick={handleRegister}
     disabled={loading}
    >
     {loading ? 'Registering...' : 'Register'}
    </button>

    <p style={styles.link}>
     Already have an Account? <Link to="/login" style={styles.a}>Sign In</Link>
    </p>
   </div>
  </div>
 )
}

const styles: Record<string, React.CSSProperties> = {

 container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'},

 card: { background: '#1e293b', padding: '2.5rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'},

 title: { fontSize: '1.8rem', fontWeight: '700', marginBottom: '0.5rem', textAlign: 'center' },

 subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: '2rem'},

 input: { width: '100%', padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '1rem'},

 button: { width: '100%', padding: '0.75rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', marginTop: '0.5rem'},

 error: { background: '#450a0a', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'},

 link: { textAlign: 'center', marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.9rem'},

 a: { color: '#6366f1'}
}