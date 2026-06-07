import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

interface Message {
 role: 'user' | 'assistant'
 content: string
}

interface Document {
  document_id: string
  filename: string
  summary: string
  created_at?: string
}

export default function Dashboard({ setToken }: { setToken: (t: string | null) => void }) {

 const [ file, setFile ] = useState<File | null>(null)
 const [ uploading, setUploading ] = useState(false)
 const [ documents, setDocuments ] = useState<Document[]>([])
 const [ activeDoc, setActiveDoc ] = useState<Document | null>(null)
 const [ conversations, setConversations ] = useState<Record<string, Message[]>>({})
 const [ input, setInput ] = useState('')
 const [ chatLoading, setChatLoading ] = useState(false)
 const [ error, setError ] = useState('')
 const [ copySuccess, setCopySuccess ] = useState(false)
 const [ downloading, setDownloading ] = useState(false)
 const chatEndRef = useRef<HTMLDivElement>(null)
 const navigate = useNavigate()
 const location = useLocation()
 const justLoggedIn = new URLSearchParams(location.search).get('loggedIn') === 'true'
 const [ showLoginSuccess, setShowLoginSuccess ] = useState(justLoggedIn)

 const token = localStorage.getItem('token')
 const headers = { Authorization: `Bearer ${token}`}

 useEffect(() => {
  if(showLoginSuccess) {
   const timer = setTimeout(() => setShowLoginSuccess(false), 3000)
   return () => clearTimeout(timer)
  }
 }, [showLoginSuccess])

 // Load existing documents on mount
 useEffect(() => {
  const fetchDocuments = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/documents', { headers})
      setDocuments(res.data)
      if(res.data.length > 0) {
        setActiveDoc(res.data[0])
      }
    } catch (err) {
      console.error('Failed to load Documents')
    }
  }
  fetchDocuments()
 }, [])

 const currentMessages = activeDoc ? (conversations[activeDoc.document_id] || []) : []

 const handleUpload = async () => {
  if(!file) return
  setUploading(true)
  setError('')

  const formData = new FormData()
  formData.append('file', file)

  try {
   const res = await axios.post('http://127.0.0.1:8000/upload', formData, { headers})
   const newDoc: Document = {
    document_id: res.data.document_id,
    filename: res.data.filename,
    summary: res.data.summary
   }
   setDocuments(prev => [newDoc, ...prev])
   setActiveDoc(newDoc)
   setConversations(prev => ({ ...prev, [newDoc.document_id]: [] }))
   setFile(null)
  } catch (err: any) {
   if(!err.response) {
    setError('Server unavailable. Please make sure the backend is running.')
   } else {
    setError(err.response?.data?.detail || 'Upload Failed. Please try again.')
   }
  }
  setUploading(false)
 }

 const handleChat = async () => {
  if(!input.trim() || !activeDoc) return
  const userMessage = input.trim()
  setInput('')

  const updatedMessages = [...currentMessages, { role: 'user' as const, content: userMessage}]
  setConversations(prev => ({ ...prev, [activeDoc.document_id]: updatedMessages}))
  setChatLoading(true)

  try {
   const res = await axios.post('http://127.0.0.1:8000/chat', { message: userMessage, document_id: activeDoc.document_id},
    { headers}
   )
   setConversations(prev => ({
    ...prev,
    [activeDoc.document_id]: [...updatedMessages, { role: 'assistant', content: res.data.reply }]
   }))
  } catch (err: any) {
   if(!err.response) {
    setError('Server unavailable. Please make sure the backend is running.')
   } else {
    setError(err.response?.data?.detail || 'Chat failed. Please try again.')
   }
  }
  setChatLoading(false)
  chatEndRef.current?.scrollIntoView({ behavior: 'smooth'})
 }

 const handleClearChat = () => {
  if(!activeDoc) return
  setConversations(prev => ({ ...prev, [activeDoc.document_id]: [] }))
 }

 const handleCopySummary = () => {
  if(!activeDoc) return
  navigator.clipboard.writeText(activeDoc.summary)
  setCopySuccess(true)
  setTimeout(() => setCopySuccess(false), 2000)
 }

 const handleDownloadSummary = async () => {
  if(!activeDoc) return
  setDownloading(true)
  try {
    const res = await axios.get(
      `http://127.0.0.1:8000/download-summary/${activeDoc.document_id}`, { headers, responseType: 'blob'}
    )
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `summary_${activeDoc.filename}.pdf`)
    link.click()
    link.remove()
  } catch (err: any) {
    setError('Failed to download summary. Please try again.')
  }
  setDownloading(false)
 }

 const handleLogout = () => {
  localStorage.removeItem('token')
  setToken(null)
 }

 return (

  <div style={styles.container}>
   {/* Header */}
   <div style={styles.header}>

    <h1 style={styles.logo}>📄 Smart Doc Reviewer</h1>

    <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>

   </div>

   { showLoginSuccess && (
      <div style={styles.toastSuccess}>Signed in successfully! Upload a document to get started.</div>
      )}

   <div style={styles.main}>

    {/* Left Panel */}

    <div style={styles.leftPanel}>

      {/* Upload Card */}
     <div style={styles.card}>

      <h2 style={styles.cardTitle}>Upload Document</h2>

      <p style={styles.cardSubtitle}>supports PDF, DOCX and TXT Files</p>

      <label style={styles.fileLabel}>

       <input
        type="file"
        accept=".pdf,.txt, .docx"
        style={{ display: 'none' }}
        onChange={e => {
          const selected = e.target.files?.[0]
          if(selected && selected.size > 5 * 1024 * 1024) {
            setError('File is too large. Please upload a file under 5 MB.')
            setFile(null)
          } else {
            setError('')
            setFile(selected || null)
          }
        }}
       />
       { file ? `📎 ${file.name}` : '+ Choose File' }
      </label>

      { file && (
        <div style={styles.selectedFile}>
          <span>📄 {file.name}</span>
          <button style={styles.removeBtn} onClick={() => setFile(null)}>✕</button>
        </div>
      )}

      <button
       style={{...styles.button, opacity: (!file || uploading) ? 0.6 : 1}}
       onClick={handleUpload}
       disabled={!file || uploading}
      >
       { uploading ? '⏳ Analyzing document...' :
              'Upload & Analyze' }
      </button>

      { error && <div style={styles.error}>{error}</div> }

     </div>

      {/* Documents List */}
     { documents.length > 0 && (
      <div style={styles.card}>
       <h2 style={styles.cardTitle}>📁 Your Documents</h2>
       <div style={styles.docList}>
        {documents.map(doc => (
          <div
            key={doc.document_id}
            style={{
              ...styles.docItem,
              background:activeDoc?.document_id === doc.document_id ? '#6366f1' : '#0f172a',
              border: activeDoc?.document_id === doc.document_id ? '1px solid #6366f1' : '1px solid #334155'              
            }}
            onClick={() => setActiveDoc(doc)}
          >
            <span style={styles.docIcon}>📄</span>
            <div style={{ overflow: 'hidden' }}>
              <div style={styles.docName}>{doc.filename}</div>
              { doc.created_at && (
                <div style={styles.docDate}>{doc.created_at}</div>
              )}
            </div>
          </div>
        ))}
       </div>
      </div>
     )}

     {/* Summary Card */ }
     {activeDoc && (
        <div style={styles.card}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem'}}>
            <h2 style={styles.cardTitle}>📋 Summary & Key Points</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={styles.copyBtn} onClick={handleCopySummary}>
              { copySuccess ? '✅ Copied!' : '📋 Copy'}
              </button>
              <button style={styles.actionBtn} onClick={handleDownloadSummary} disabled={downloading}>
              { downloading ? '⏳' : '⬇️ PDF'}
              </button>
            </div>
          </div>
          <p style={styles.docActiveLabel}>📄 {activeDoc.filename}</p>
          <p style={styles.summaryText}>{activeDoc.summary}</p>
        </div>
      )}

    </div>

    { /* Right Panel - Chat */}

    <div style={styles.rightPanel}>

     <div style={styles.card}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem'}}>
        <h2 style={styles.cardTitle}>💬 Ask About Your Document</h2>
        { activeDoc && currentMessages.length > 0 && (
          <button style={styles.actionBtn} onClick={handleClearChat}>
            🗑️ Clear Chat
          </button>
        )}
      </div>

      {!activeDoc ? (
        <p style={styles.cardSubtitle}>Upload a document to start chatting</p>
      ) : (
        <p style={styles.docActiveLabel}>Chatting about: 📄 {activeDoc.filename}</p>
      )}

      <div style={styles.chatBox}>

       { currentMessages.length === 0 && activeDoc && (
        <p style={styles.chatPlaceholder}>Ask anything about "{activeDoc.filename}"...</p>
       )}

       { currentMessages.map((msg, i) => (
        <div key={i} style={{
         ...styles.message,
         alignSelf:msg.role === 'user' ? 'flex-end' : 'flex-start',
         background: msg.role === 'user' ? '#6366f1' : '#334155',
        }}>
         <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem', opacity: 0.8 }}>
          {msg.role === 'user' ? '🧑 You' : '🤖 AI'}
         </div>
         <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        </div>
       ))}

       {chatLoading && (
        <div style={{...styles.message, 
         alignSelf: 'flex-start',
         background: '#334155',
         color: '#ffffff'         
        }}>
         <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem', opacity: 0.8 }}>🤖 AI</div>
          <span style={styles.typingDots}>Thinking...</span>
        </div>
       )}

       <div ref={chatEndRef}/>

      </div>

      <div style={styles.inputRow}>
       <input
        style={styles.chatInput}
        placeholder={activeDoc ? "Ask a Question..." : "Upload a Document first" }
        value={input}
        disabled={!activeDoc}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleChat()}
        />

        <button
         style={{...styles.sendBtn,
          opacity: (!activeDoc || chatLoading) ? 0.6 : 1 
         }}
         onClick={handleChat}
         disabled={!activeDoc || chatLoading}
         >
         Send
        </button>

      </div>

     </div>

    </div>

   </div>

  </div>

 )
}

const styles: Record<string, React.CSSProperties> = {

 container: { minHeight: '100vh', display: 'flex', flexDirection: 'column'},

 header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: '#1e293b', borderBottom: '1px solid #334155'},

 logo: { fontSize: '1.4rem', fontWeight: '700'},

 logoutBtn: { background: 'transparent',  border: '1px solid #475569', color: '#94a3b8', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem'},

 toastSuccess: { background: '#052e16', color: '#86efac', padding: '0.75rem 2rem', fontSize: '0.9rem', textAlign: 'center' },

 main: { display: 'flex', gap: '1.5rem', padding: '1.5rem', flex: 1, flexWrap: 'wrap'},

 leftPanel: { display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1', minWidth: '280px'},

 rightPanel: { flex: '2', minWidth: '320px'},

 card: { background: '#1e293b', borderRadius: '16px', padding: '1.5rem', border: '1px solid #334155'},

 cardTitle: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.4rem'},

 cardSubtitle: { color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.2rem'},

 fileLabel: { display: 'block', border: '2px dashed #334155', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.95rem' },

 selectedFile: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#94a3b8' },

 removeBtn: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' },  

 button: { width: '100%', padding: '0.75rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600' },

 error: { background: '#450a0a', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem' },

 docList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' },

 docItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' },

 docIcon: { fontSize: '1.1rem' },

 docName: { fontSize: '0.9rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

 docDate: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' },

 docActiveLabel: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }, 

 summaryText: { color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' },

  actionBtn: { background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' },

 chatBox: { display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '350px', maxHeight: '450px', overflowY: 'auto', marginBottom: '1rem', padding: '0.5rem' },

 message: { padding: '0.75rem 1rem', borderRadius: '12px', maxWidth: '80%', fontSize: '0.95rem', lineHeight: '1.6' },

 messageRole: { fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem', opacity: 0.8 },

 chatPlaceholder: { color: '#475569', textAlign: 'center', marginTop: '4rem' },

 typingDots: { opacity: 0.7 },

 inputRow: { display: 'flex', gap: '0.75rem' },

 chatInput: { flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '0.95rem' },

 sendBtn: { padding: '0.75rem 1.5rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' },

 success: { background: '#052e16', color: '#86efac', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' },

 clearBtn: { background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' },

 copyBtn: { background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }
}