import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";

export default function Login({ setToken }: { setToken: (t: string) => void }) {

 const [username, setUsername] = useState('')
 const [password, setPassword] = useState('')
 const [error, setError] = useState('')
 const [loading, setLoading] = useState(false)
 const navigate = useNavigate()
 const [ searchParams ] = useSearchParams()
 const justRegistered = searchParams.get('registered') === 'true'
 const justLoggedOut = searchParams.get('loggedOut') === 'true'
 const [ showSuccess, setShowSuccess ] = useState(justRegistered || justLoggedOut)

 useEffect(() => {
  if(showSuccess) {
   const timer = setTimeout(() => setShowSuccess(false), 3000)
   return() => clearTimeout(timer)
  }
 }, [showSuccess])

 const handleLogin = async () => {
  setLoading(true)
  setError('')
  try {
   const res = await axios.post('https://13.206.88.177.nip.io/login', { username, password })
   localStorage.setItem('token', res.data.access_token)
   setToken(res.data.access_token)
   navigate('/dashboard?loggedIn=true')
  } catch (err: any) {
   if(!err.response) {
    setError('Server unavailable. Please try again later or make sure the backend server is running.') 
   } else {
    setError(err.response?.data?.detail || 'Login Failed. Please try again.')
   }
  }
  setLoading(false)
 }

 return (

  <div style={styles.container}>

   <div style={styles.card}>

    <h1 style={styles.title}>Smart doc Reviewer</h1>

    <p style={styles.subtitle}>Sign in to your Account</p>

    { showSuccess && justRegistered && <div style={styles.success}>Registration successful! Please sign in.</div> }

    { showSuccess && justLoggedOut && <div style={styles.success}>Logged out successfully. See you soon!</div>}

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
     onClick={handleLogin}
     disabled={loading}
    >
     {loading ? 'Signing in...' : 'Sign In'}
    </button>

    <p style={styles.link}>
     Don't have an Account? <Link to="/register" style={styles.a}>Register</Link>
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

 a: { color: '#6366f1'},

 success: { background: '#052e16', color: '#86efac', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' },
}