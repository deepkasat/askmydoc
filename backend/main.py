from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import Groq
import PyPDF2
import docx
import io
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------- Database Setup for Users -----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'users.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class UserModel(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True, index=True)
    hashed_password = Column(String, nullable=False)

# ----------- Database Setup for Document -----------
class DocumentModel(Base):
    __tablename__ = "documents"
    doc_id = Column(String, primary_key=True, index=True)
    username = Column(String, index=True)
    filename = Column(String)
    summary = Column(Text)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------- Auth Setup -----------
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ----------- Groq Setup -----------
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.1-8b-instant"

# ----------- In-memory document storage -----------
conversations_db = {}

# ----------- Models -----------

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str
    document_id: str

# ----------- Auth Helpers -----------

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

def create_token(username: str):
    expire = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)
                     ):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ----------- Routes -----------

@app.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(UserModel).filter(UserModel.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = UserModel(username=req.username, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    return {"message": "Registered successfully"}

@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == req.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Wrong password")
    token = create_token(req.username)
    return {"access_token": token}

@app.get("/documents")
def get_documents(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).filter(
        DocumentModel.username == username
    ).order_by(DocumentModel.created_at.desc()).all()
    return [
        {
            "document_id": d.doc_id,
            "filename": d.filename,
            "summary": d.summary,
            "created_at": d.created_at.strftime("%d %b %Y, %I:%M %p") if d.created_at else ""
        }
        for d in docs
    ]

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()

    # Extract text based on file type
    if file.filename.endswith(".pdf"):
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
    elif file.filename.endswith(".txt"):
        text = content.decode("utf-8")
    elif file.filename.endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        text = "\n".join([para.text for para in doc.paragraphs])
    else:
        raise HTTPException(status_code=400, detail="Unsupported File type. Please upload a PDF, DOCX or TXT file only.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file. Make sure the PDF is not scanned or image-based.")
    
    if len(text) > 100000:
        raise HTTPException(status_code=400, detail="File is too large to process. Please upload a file with less than 1,00,000 Characters.")

    # Generate summary using Groq
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful document analyst. Provide clear, concise analysis."
            },
            {
                "role": "user",
                "content": f"""Analyze this document and provide:
1. A clear summary in 3-4 sentences
2. Exactly 5 key points, no more no less. Each as a bullet points with a short one-line explanation of maximum 15 words.

Format exactly like this example:
- Meaningful Topic Name: One line explanation in maximum 15 words.
- Meaningful Topic Name: One line explanation in maximum 15 words.
- Meaningful Topic Name: One line explanation in maximum 15 words.
- Meaningful Topic Name: One line explanation in maximum 15 words.
- Meaningful Topic Name: One line explanation in maximum 15 words.

Rules:
- Exactly 5 bullet points, no more no less.
- Each heading must be a real topic from the document, not "Key Point 1".
- Each explanation must be maximum 15 words.

Document:
{text[:6000]}"""
            }
        ],
        max_tokens=1000
    )

    summary = response.choices[0].message.content

    # Store document in SQLite
    doc_id = f"{username}_{file.filename}_{datetime.utcnow().timestamp()}"
    db_doc = DocumentModel(
        doc_id=doc_id,
        username=username,
        filename= file.filename,
        summary=summary,
        text=text[:100000],
        created_at=datetime.utcnow()
    )
    db.add(db_doc)
    db.commit()

    # Init conversation
    conversations_db[doc_id] = []

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "summary": summary
    }

@app.post("/chat")
def chat(req: ChatRequest, username: str = Depends(get_current_user), db: Session = Depends(get_db)):

    # Try memory first, then database
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == req.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="document not Found.")
    
    if req.document_id not in conversations_db:
        conversations_db[req.document_id] = []

    conversation = conversations_db[req.document_id]

    # Build messages with document context
    messages = [
        {
            "role": "system",
            "content": f"""You are a helpful document assistant. 
Answer questions based only on this document:

{doc.text[:6000]}

Be concise and accurate. If the answer is not in the document, say so."""
        }
    ]

    # Add conversation history
    for msg in conversation:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    # Add current question
    messages.append({
        "role": "user",
        "content": req.message
    })

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1000
    )

    assistant_reply = response.choices[0].message.content

    # Save conversation
    conversation.append({"role": "user", "content": req.message})
    conversation.append({"role": "assistant", "content": assistant_reply})

    return {"reply": assistant_reply}

@app.get("/download-summary/{doc_id}")
def download_summary(doc_id: str, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(
        DocumentModel.doc_id == doc_id,
        DocumentModel.username == username
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    # Generate PDF
    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=inch, leftMargin=inch,
                            topMargin=inch, bottomMargin=inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, spaceAfter=12)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, textColor='grey', spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, leading=18, alignment=TA_LEFT)

    story = []
    story.append(Paragraph("AskMyDoc - Document Summary", title_style))
    story.append(Paragraph(f"File: {doc.filename}", subtitle_style))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%d %b %Y, %I:%M %p')} UTC", subtitle_style))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Summary & Key points", styles['Heading2']))
    story.append(Spacer(1, 0.1 * inch))

    for line in doc.summary.split('\n'):
        if line.strip():
            clean_line = line.replace('•', '&#8226;')
            story.append(Paragraph(clean_line, body_style))
            story.append(Spacer(1, 0.1 * inch))

    pdf.build(story)
    buffer.seek(0)

    filename = f"summary_{doc.filename.replace('.', '_')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/health")
def health():
    return {"status": "running"}