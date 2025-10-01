from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import json
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = "music_maestro_secret_key_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*"
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Chord transposition mappings
CHORD_MAPPINGS = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
}

REVERSE_CHORD_MAPPINGS = {
    0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
    6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
}

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class Song(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    artist: str
    lyrics: Optional[str] = None
    chords: Optional[str] = None
    key: Optional[str] = None
    genre: Optional[str] = None
    tempo: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SongCreate(BaseModel):
    title: str
    artist: str

class Instrument(BaseModel):
    name: str
    category: str
    notation_type: str  # "chords", "notes", "rhythm", "tabs"

class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(default_factory=lambda: str(uuid.uuid4())[:6].upper())
    name: str
    admin_id: str
    current_song_id: Optional[str] = None
    next_song_id: Optional[str] = None
    playlist: List[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomCreate(BaseModel):
    name: str

class RoomMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    user_id: str
    user_name: str
    instrument: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JoinRoom(BaseModel):
    room_code: str
    instrument: str

class MusicAnalysis(BaseModel):
    song_id: str
    analysis: Dict[str, Any]
    recommendations: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InstrumentNotation(BaseModel):
    instrument: str
    notation: str
    difficulty: str  # "beginner", "intermediate", "advanced"

class TransposeRequest(BaseModel):
    from_key: str
    to_key: str
    
class RepertoireUpdate(BaseModel):
    action: str  # "add_song", "remove_song", "reorder", "transpose"
    data: Dict[str, Any]

# Predefined instruments
INSTRUMENTS = [
    {"name": "Violão", "category": "Cordas", "notation_type": "chords"},
    {"name": "Guitarra", "category": "Cordas", "notation_type": "chords"},
    {"name": "Baixo", "category": "Cordas", "notation_type": "notes"},
    {"name": "Bateria", "category": "Percussão", "notation_type": "rhythm"},
    {"name": "Teclado", "category": "Teclas", "notation_type": "chords"},
    {"name": "Piano", "category": "Teclas", "notation_type": "chords"},
    {"name": "Cajon", "category": "Percussão", "notation_type": "rhythm"},
    {"name": "Ukulele", "category": "Cordas", "notation_type": "chords"},
    {"name": "Saxofone", "category": "Sopro", "notation_type": "notes"},
    {"name": "Flauta", "category": "Sopro", "notation_type": "notes"},
    {"name": "Trompete", "category": "Sopro", "notation_type": "notes"}
]

# Utility Functions
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": user_email})
    if user is None:
        raise credentials_exception
    
    return User(**user)

async def search_song_data(title: str, artist: str) -> Dict[str, Any]:
    """Search for song data using AI to generate plausible chords and lyrics"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"song_search_{uuid.uuid4()}",
            system_message="Você é um especialista em música que fornece acordes, letras e informações sobre músicas populares brasileiras e internacionais."
        ).with_model("openai", "gpt-5")
        
        message = UserMessage(
            text=f"""Forneça informações sobre a música "{title}" do artista "{artist}":
            
            1. Letra completa (se conhecida)
            2. Sequência de acordes principais
            3. Tom da música
            4. Gênero musical
            5. Andamento aproximado (BPM)
            
            Se não conhecer a música exatamente, forneça uma estrutura típica do gênero do artista.
            Responda em formato JSON com as chaves: lyrics, chords, key, genre, tempo"""
        )
        
        response = await chat.send_message(message)
        
        # Parse JSON response
        try:
            data = json.loads(response)
            return {
                "lyrics": data.get("lyrics", "Letra não disponível"),
                "chords": data.get("chords", "Acordes não disponíveis"),
                "key": data.get("key", "C"),
                "genre": data.get("genre", "Popular"),
                "tempo": data.get("tempo", 120)
            }
        except:
            # Fallback if JSON parsing fails
            return {
                "lyrics": "Letra não disponível - consulte fontes oficiais",
                "chords": "Acordes básicos: C - G - Am - F",
                "key": "C",
                "genre": "Popular",
                "tempo": 120
            }
    except Exception as e:
        logging.error(f"Error searching song data: {e}")
        return {
            "lyrics": "Erro ao buscar letra",
            "chords": "C - G - Am - F",
            "key": "C",
            "genre": "Unknown",
            "tempo": 120
        }

def transpose_chord(chord: str, semitones: int) -> str:
    """Transpose a single chord by semitones"""
    try:
        # Extract the base note (first 1 or 2 characters)
        if len(chord) > 1 and chord[1] in ['#', 'b']:
            base_note = chord[:2]
            suffix = chord[2:]
        else:
            base_note = chord[0]
            suffix = chord[1:]
        
        if base_note in CHORD_MAPPINGS:
            original_value = CHORD_MAPPINGS[base_note]
            new_value = (original_value + semitones) % 12
            new_base = REVERSE_CHORD_MAPPINGS[new_value]
            return new_base + suffix
        return chord
    except:
        return chord

def transpose_chords_string(chords_text: str, from_key: str, to_key: str) -> str:
    """Transpose all chords in a text from one key to another"""
    try:
        if from_key not in CHORD_MAPPINGS or to_key not in CHORD_MAPPINGS:
            return chords_text
        
        semitones = (CHORD_MAPPINGS[to_key] - CHORD_MAPPINGS[from_key]) % 12
        
        # Pattern to match chord symbols
        chord_pattern = r'\b([A-G][#b]?(?:maj|min|m|M|sus|aug|dim|add|\d)*)\b'
        
        def replace_chord(match):
            chord = match.group(1)
            return transpose_chord(chord, semitones)
        
        return re.sub(chord_pattern, replace_chord, chords_text)
    except:
        return chords_text

async def generate_instrument_notation(song: Song, instrument: str) -> str:
    """Generate specific notation for an instrument"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"notation_{uuid.uuid4()}",
            system_message="Você é um especialista em música que cria notações específicas para diferentes instrumentos."
        ).with_model("openai", "gpt-5")
        
        notation_prompts = {
            "Violão": "Forneça os acordes principais para violão com dedilhado sugerido",
            "Guitarra": "Forneça os acordes e possíveis riffs/solos para guitarra",
            "Baixo": "Forneça as notas fundamentais e linha de baixo sugerida",
            "Bateria": "Forneça a levada e padrão rítmico sugerido",
            "Teclado": "Forneça os acordes e possível melodia para teclado",
            "Piano": "Forneça os acordes completos e arranjo para piano",
            "Cajon": "Forneça o padrão rítmico e técnicas de percussão",
            "Ukulele": "Forneça os acordes adaptados para ukulele"
        }
        
        prompt = notation_prompts.get(instrument, "Forneça notação básica para este instrumento")
        
        message = UserMessage(
            text=f"""Para a música "{song.title}" de "{song.artist}" no tom de {song.key}:
            
            {prompt}
            
            Acordes conhecidos: {song.chords}
            Gênero: {song.genre}
            
            Responda de forma prática e direta para músicos em apresentação ao vivo."""
        )
        
        response = await chat.send_message(message)
        return response
        
    except Exception as e:
        logging.error(f"Error generating notation: {e}")
        return f"Notação básica para {instrument} não disponível no momento"

# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ, auth):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    room_id = data.get('room_id')
    if room_id:
        await sio.enter_room(sid, room_id)
        await sio.emit('user_joined', {'user_id': data.get('user_id'), 'user_name': data.get('user_name')}, room=room_id)

@sio.event
async def leave_room(sid, data):
    room_id = data.get('room_id')
    if room_id:
        await sio.leave_room(sid, room_id)
        await sio.emit('user_left', {'user_id': data.get('user_id')}, room=room_id)

@sio.event
async def song_changed(sid, data):
    room_id = data.get('room_id')
    song_data = data.get('song')
    if room_id:
        await sio.emit('song_changed', {'song': song_data}, room=room_id)

@sio.event
async def transpose_changed(sid, data):
    room_id = data.get('room_id')
    new_key = data.get('new_key')
    if room_id and new_key:
        await sio.emit('transpose_changed', {'new_key': new_key}, room=room_id)

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password_hash"] = hash_password(user_data.password)
    del user_dict["password"]
    
    user = User(**user_dict)
    await db.users.insert_one(user.dict())
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        created_at=user.created_at
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

# Song Routes
@api_router.post("/songs/search", response_model=Song)
async def search_song(song_data: SongCreate, current_user: User = Depends(get_current_user)):
    # Check if song already exists
    existing_song = await db.songs.find_one({
        "title": {"$regex": f"^{song_data.title}$", "$options": "i"},
        "artist": {"$regex": f"^{song_data.artist}$", "$options": "i"}
    })
    
    if existing_song:
        return Song(**existing_song)
    
    # Search for song data
    song_info = await search_song_data(song_data.title, song_data.artist)
    
    # Create new song
    song = Song(
        title=song_data.title,
        artist=song_data.artist,
        **song_info
    )
    
    await db.songs.insert_one(song.dict())
    return song

@api_router.get("/songs/{song_id}", response_model=Song)
async def get_song(song_id: str, current_user: User = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return Song(**song)

@api_router.get("/songs/{song_id}/notation/{instrument}")
async def get_instrument_notation(
    song_id: str, 
    instrument: str,
    current_user: User = Depends(get_current_user)
):
    song = await db.songs.find_one({"id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    song_obj = Song(**song)
    notation = await generate_instrument_notation(song_obj, instrument)
    
    return {
        "instrument": instrument,
        "song_title": song_obj.title,
        "artist": song_obj.artist,
        "notation": notation,
        "key": song_obj.key
    }

# Room Routes
@api_router.post("/rooms/create", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    room = Room(
        name=room_data.name,
        admin_id=current_user.id
    )
    
    await db.rooms.insert_one(room.dict())
    return room

@api_router.post("/rooms/join")
async def join_room(join_data: JoinRoom, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"code": join_data.room_code, "is_active": True})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user already in room
    existing_member = await db.room_members.find_one({
        "room_id": room["id"],
        "user_id": current_user.id
    })
    
    if existing_member:
        # Update instrument
        await db.room_members.update_one(
            {"room_id": room["id"], "user_id": current_user.id},
            {"$set": {"instrument": join_data.instrument}}
        )
    else:
        # Add new member
        member = RoomMember(
            room_id=room["id"],
            user_id=current_user.id,
            user_name=current_user.name,
            instrument=join_data.instrument
        )
        await db.room_members.insert_one(member.dict())
    
    return {"message": "Joined room successfully", "room": Room(**room)}

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get room members
    members = await db.room_members.find({"room_id": room_id}).to_list(100)
    
    # Get current and next songs
    current_song = None
    next_song = None
    
    if room["current_song_id"]:
        current_song = await db.songs.find_one({"id": room["current_song_id"]})
    
    if room["next_song_id"]:
        next_song = await db.songs.find_one({"id": room["next_song_id"]})
    
    return {
        "room": Room(**room),
        "members": [RoomMember(**member) for member in members],
        "current_song": Song(**current_song) if current_song else None,
        "next_song": Song(**next_song) if next_song else None
    }

@api_router.post("/rooms/{room_id}/set-current-song")
async def set_current_song(
    room_id: str,
    song_id: str,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can change songs")
    
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"current_song_id": song_id}}
    )
    
    return {"message": "Current song updated"}

@api_router.post("/rooms/{room_id}/set-next-song")
async def set_next_song(
    room_id: str,
    song_id: str,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can change songs")
    
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"next_song_id": song_id}}
    )
    
    return {"message": "Next song updated"}

# Instruments Route
@api_router.get("/instruments")
async def get_instruments():
    return INSTRUMENTS

# AI Recommendations
@api_router.get("/rooms/{room_id}/recommendations")
async def get_recommendations(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room["current_song_id"]:
        return {"recommendations": []}
    
    current_song = await db.songs.find_one({"id": room["current_song_id"]})
    if not current_song:
        return {"recommendations": []}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"recommendations_{uuid.uuid4()}",
            system_message="Você é um especialista musical que recomenda músicas para shows ao vivo baseado no estilo e energia."
        ).with_model("openai", "gpt-5")
        
        message = UserMessage(
            text=f"""Baseado na música atual "{current_song["title"]}" de "{current_song["artist"]}" 
            (gênero: {current_song["genre"]}, tom: {current_song["key"]}), 
            recomende 5 músicas que fluiriam bem em seguida para um show ao vivo.
            
            Considere:
            - Continuidade de energia
            - Compatibilidade harmônica
            - Facilidade de transição para os músicos
            
            Responda apenas com uma lista simples de "Título - Artista" para cada recomendação."""
        )
        
        response = await chat.send_message(message)
        
        # Parse recommendations
        recommendations = []
        lines = response.strip().split('\n')
        for line in lines:
            if ' - ' in line:
                recommendations.append(line.strip())
        
        return {"recommendations": recommendations[:5]}
        
    except Exception as e:
        logging.error(f"Error generating recommendations: {e}")
        return {"recommendations": []}

# Basic Routes
@api_router.get("/")
async def root():
    return {"message": "Music Maestro API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()