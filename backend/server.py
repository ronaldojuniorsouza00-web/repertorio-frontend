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
from music_services import MusicAPIService
from cache_service import CacheService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize services with caching
cache_service = CacheService(db)
music_service = MusicAPIService(cache_service)

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
    # New fields from real APIs
    album: Optional[str] = None
    release_date: Optional[str] = None
    popularity: Optional[int] = None
    preview_url: Optional[str] = None
    duration_ms: Optional[int] = None
    spotify_data: Optional[Dict[str, Any]] = None
    genius_url: Optional[str] = None
    structure: Optional[str] = None
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
    # New settings
    current_tempo: int = 120
    font_size: int = 16
    presentation_mode: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomCreate(BaseModel):
    name: str

class RoomMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    user_id: str
    user_name: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JoinRoom(BaseModel):
    room_code: str

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

class Recording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    user_id: str
    user_name: str
    recording_name: str
    filename: str
    duration: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_playing: bool = False
    volume: float = 1.0

class StartRecordingRequest(BaseModel):
    recording_name: str

class AIRepertoireRequest(BaseModel):
    style: str  # "rock", "pop", "jazz", etc.
    duration_minutes: Optional[int] = 60
    energy_level: str  # "baixa", "media", "alta"
    audience_type: str  # "familia", "jovens", "adultos"

class SongSearch(BaseModel):
    query: str

class SongControlSettings(BaseModel):
    tempo: Optional[int] = None  # BPM adjustment
    key: Optional[str] = None   # Key signature
    font_size: Optional[int] = 16  # Font size for lyrics
    
class RoomSettings(BaseModel):
    current_tempo: Optional[int] = 120
    current_key: Optional[str] = "C"
    font_size: Optional[int] = 16
    presentation_mode: Optional[bool] = False

# Collaborative recording system - no more individual instruments needed

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
    """Search for song data using real APIs (Spotify + Genius) + AI fallback"""
    try:
        # Use the comprehensive music service
        result = await music_service.search_song_comprehensive(title, artist)
        
        return {
            "lyrics": result.get("lyrics", "Letra não disponível"),
            "chords": result.get("chords", "C - G - Am - F"),
            "key": result.get("key", "C"),
            "genre": result.get("genre", "Popular"),
            "tempo": result.get("tempo", 120),
            "structure": result.get("structure", "Verso - Refrão"),
            # Additional metadata from real APIs
            "album": result.get("album"),
            "release_date": result.get("release_date"),
            "popularity": result.get("popularity", 0),
            "preview_url": result.get("preview_url"),
            "duration_ms": result.get("duration_ms"),
            "spotify_data": result.get("spotify_data"),
            "genius_url": result.get("genius_url")
        }
        
    except Exception as e:
        logging.error(f"Error in comprehensive song search: {e}")
        # Final fallback
        return {
            "lyrics": f"[Verso 1]\n     C              G              Am             F\nLetra da música '{title}' de '{artist}'\n     C              G              F              G\nConsulte fontes oficiais para letra completa",
            "chords": "C - G - Am - F",
            "key": "C",
            "genre": "Popular",
            "tempo": 120,
            "structure": "Verso - Refrão"
        }

async def intelligent_song_search(query: str) -> List[Dict[str, Any]]:
    """Intelligent search using Spotify + AI fallback"""
    try:
        # Use the music service for intelligent search
        results = await music_service.intelligent_search(query)
        return results
        
    except Exception as e:
        logging.error(f"Error in intelligent search: {e}")
        return []

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

# Instrument notation function removed - no longer needed for collaborative system

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

@sio.event
async def audio_stream(sid, data):
    room_id = data.get('room_id')
    audio_data = data.get('audio_data')
    user_id = data.get('user_id')
    if room_id and audio_data:
        # Broadcast audio to other room members (excluding sender)
        await sio.emit('audio_received', {
            'audio_data': audio_data,
            'user_id': user_id
        }, room=room_id, skip_sid=sid)

@sio.event
async def recording_chunk(sid, data):
    room_id = data.get('room_id')
    recording_id = data.get('recording_id')
    chunk_data = data.get('chunk_data')
    # In production, save chunk to file system or cloud storage
    # For now, just acknowledge receipt
    await sio.emit('chunk_received', {
        'recording_id': recording_id,
        'status': 'received'
    }, room=sid)

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

@api_router.post("/songs/intelligent-search")
async def intelligent_search(search_data: SongSearch, current_user: User = Depends(get_current_user)):
    """Spotify + AI powered song search"""
    results = await intelligent_song_search(search_data.query)
    return {"results": results}

@api_router.post("/songs/recognize-audio")
async def recognize_audio_endpoint(
    audio_file: bytes,
    current_user: User = Depends(get_current_user)
):
    """Recognize song from audio using AUdD API"""
    try:
        # Save temporary audio file
        temp_path = f"/tmp/audio_recognition_{uuid.uuid4()}.mp3"
        with open(temp_path, 'wb') as f:
            f.write(audio_file)
        
        # Recognize using AUdD
        result = await music_service.recognize_audio(temp_path)
        
        # Clean up temp file
        os.remove(temp_path)
        
        if result:
            return {
                "recognized": True,
                "song": result
            }
        else:
            return {
                "recognized": False,
                "message": "Música não reconhecida"
            }
            
    except Exception as e:
        logging.error(f"Audio recognition error: {e}")
        return {
            "recognized": False,
            "error": str(e)
        }

@api_router.get("/songs/{song_id}", response_model=Song)
async def get_song(song_id: str, current_user: User = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return Song(**song)

# Instrument notation endpoint removed - no longer needed for collaborative system

@api_router.post("/songs/{song_id}/transpose")
async def transpose_song(
    song_id: str,
    transpose_data: TransposeRequest,
    current_user: User = Depends(get_current_user)
):
    song = await db.songs.find_one({"id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    song_obj = Song(**song)
    
    # Transpose chords
    new_chords = transpose_chords_string(song_obj.chords or "", transpose_data.from_key, transpose_data.to_key)
    
    # Update song with new key and transposed chords
    await db.songs.update_one(
        {"id": song_id},
        {"$set": {"key": transpose_data.to_key, "chords": new_chords}}
    )
    
    return {
        "message": "Song transposed successfully",
        "new_key": transpose_data.to_key,
        "new_chords": new_chords
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
    
    if not existing_member:
        # Add new member (no instrument needed anymore)
        member = RoomMember(
            room_id=room["id"],
            user_id=current_user.id,
            user_name=current_user.name
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

@api_router.post("/rooms/{room_id}/transpose")
async def transpose_room_repertoire(
    room_id: str,
    transpose_data: TransposeRequest,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can transpose repertoire")
    
    # Transpose current song if exists
    if room.get("current_song_id"):
        song = await db.songs.find_one({"id": room["current_song_id"]})
        if song:
            new_chords = transpose_chords_string(song.get("chords", ""), transpose_data.from_key, transpose_data.to_key)
            await db.songs.update_one(
                {"id": room["current_song_id"]},
                {"$set": {"key": transpose_data.to_key, "chords": new_chords}}
            )
    
    # Emit real-time update
    await sio.emit('transpose_changed', {
        'room_id': room_id,
        'new_key': transpose_data.to_key,
        'user': current_user.name
    }, room=room_id)
    
    return {"message": "Room repertoire transposed successfully"}

@api_router.get("/rooms/{room_id}/sync")
async def sync_room_state(room_id: str, current_user: User = Depends(get_current_user)):
    room_data = await get_room(room_id, current_user)
    
    # Emit current state to all users in room
    await sio.emit('room_sync', {
        'room': room_data["room"].dict() if hasattr(room_data["room"], 'dict') else room_data["room"],
        'current_song': room_data["current_song"].dict() if room_data["current_song"] and hasattr(room_data["current_song"], 'dict') else room_data["current_song"],
        'next_song': room_data["next_song"].dict() if room_data["next_song"] and hasattr(room_data["next_song"], 'dict') else room_data["next_song"],
        'members': [member.dict() if hasattr(member, 'dict') else member for member in room_data["members"]]
    }, room=room_id)
    
    return {"message": "Room state synchronized"}

# Instruments endpoint removed - no longer needed for collaborative system

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

# AI Repertoire Generation - OPTIMIZED
@api_router.post("/rooms/{room_id}/generate-repertoire")
async def generate_ai_repertoire(
    room_id: str,
    repertoire_request: AIRepertoireRequest,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can generate repertoire")
    
    # Check cache first for repertoire generation
    cache_key_data = {
        "style": repertoire_request.style,
        "duration": repertoire_request.duration_minutes,
        "energy": repertoire_request.energy_level,
        "audience": repertoire_request.audience_type
    }
    
    cached_repertoire = await cache_service.get_cached_result(
        "ai_repertoire",
        cache_key_data,
        max_age_hours=48  # Cache repertoires for 2 days
    )
    
    if cached_repertoire:
        logging.info(f"Cache hit for repertoire: {repertoire_request.style}")
        return cached_repertoire
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"repertoire_{repertoire_request.style}_{repertoire_request.duration_minutes}",
            system_message="Curador musical rápido. Responda apenas com lista de músicas."
        ).with_model("openai", "gpt-5")
        
        # Shorter, more focused prompt for speed
        message = UserMessage(
            text=f"""Repertório {repertoire_request.style} - {repertoire_request.duration_minutes}min
            Energia: {repertoire_request.energy_level}
            Público: {repertoire_request.audience_type}
            
            Liste 15 músicas conhecidas no formato exato:
            "Título - Artista - 3min"
            
            APENAS a lista, sem texto adicional."""
        )
        
        # Set timeout for AI call
        response = await asyncio.wait_for(
            chat.send_message(message),
            timeout=12.0  # 12 second timeout
        )
        
        # Parse repertoire quickly
        repertoire = []
        lines = response.strip().split('\n')
        for line in lines:
            line = line.strip()
            if ' - ' in line and len(line.split(' - ')) >= 2:
                parts = line.split(' - ')
                if len(parts) >= 2:
                    title = parts[0].strip(' "')
                    artist = parts[1].strip()
                    duration = parts[2].strip() if len(parts) > 2 else "3min"
                    
                    repertoire.append({
                        "title": title,
                        "artist": artist,
                        "duration": duration,
                        "original_line": line
                    })
        
        result = {
            "repertoire": repertoire,
            "style": repertoire_request.style,
            "total_songs": len(repertoire),
            "estimated_duration": repertoire_request.duration_minutes
        }
        
        # Cache the result
        await cache_service.set_cached_result(
            "ai_repertoire",
            cache_key_data,
            result
        )
        
        return result
        
    except asyncio.TimeoutError:
        logging.warning("AI repertoire generation timeout")
        raise HTTPException(status_code=408, detail="Timeout generating repertoire. Try again.")
    except Exception as e:
        logging.error(f"Error generating repertoire: {e}")
        raise HTTPException(status_code=500, detail="Error generating repertoire")

# Recording functionality
@api_router.post("/rooms/{room_id}/start-recording")
async def start_recording(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Create recording entry
    recording = Recording(
        room_id=room_id,
        filename=f"recording_{room_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm",
        created_by=current_user.id
    )
    
    await db.recordings.insert_one(recording.dict())
    
    # Emit to all room members
    await sio.emit('recording_started', {
        'recording_id': recording.id,
        'started_by': current_user.name
    }, room=room_id)
    
    return {"message": "Recording started", "recording_id": recording.id}

@api_router.post("/rooms/{room_id}/stop-recording/{recording_id}")
async def stop_recording(
    room_id: str, 
    recording_id: str,
    duration: int,
    current_user: User = Depends(get_current_user)
):
    # Update recording with duration
    await db.recordings.update_one(
        {"id": recording_id, "room_id": room_id},
        {"$set": {"duration": duration}}
    )
    
    # Emit to all room members
    await sio.emit('recording_stopped', {
        'recording_id': recording_id,
        'duration': duration,
        'stopped_by': current_user.name
    }, room=room_id)
    
    return {"message": "Recording stopped"}

@api_router.get("/rooms/{room_id}/recordings")
async def get_recordings(room_id: str, current_user: User = Depends(get_current_user)):
    recordings = await db.recordings.find({"room_id": room_id}).to_list(100)
    return {"recordings": [Recording(**rec) for rec in recordings]}

# Presentation Mode
@api_router.post("/rooms/{room_id}/presentation-mode")
async def toggle_presentation_mode(
    room_id: str,
    enabled: bool,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can toggle presentation mode")
    
    # Update room presentation mode
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"presentation_mode": enabled}}
    )
    
    # Emit to all room members
    await sio.emit('presentation_mode_changed', {
        'enabled': enabled,
        'changed_by': current_user.name
    }, room=room_id)
    
    return {"message": f"Presentation mode {'enabled' if enabled else 'disabled'}"}

# Room Settings Control
@api_router.post("/rooms/{room_id}/settings")
async def update_room_settings(
    room_id: str,
    settings: SongControlSettings,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is admin for tempo/key changes, anyone can change font size
    if (settings.tempo is not None or settings.key is not None) and room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can change tempo and key")
    
    update_data = {}
    if settings.tempo is not None:
        update_data["current_tempo"] = settings.tempo
    if settings.key is not None and settings.key in CHORD_MAPPINGS:
        # Transpose current song if exists
        if room.get("current_song_id"):
            song = await db.songs.find_one({"id": room["current_song_id"]})
            if song:
                old_key = song.get("key", "C")
                new_chords = transpose_chords_string(song.get("chords", ""), old_key, settings.key)
                await db.songs.update_one(
                    {"id": room["current_song_id"]},
                    {"$set": {"key": settings.key, "chords": new_chords}}
                )
    if settings.font_size is not None:
        update_data["font_size"] = settings.font_size
    
    if update_data:
        await db.rooms.update_one({"id": room_id}, {"$set": update_data})
        
        # Emit real-time update
        await sio.emit('room_settings_changed', {
            'settings': update_data,
            'changed_by': current_user.name
        }, room=room_id)
    
    return {"message": "Settings updated successfully", "settings": update_data}

@api_router.get("/rooms/{room_id}/settings")
async def get_room_settings(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "current_tempo": room.get("current_tempo", 120),
        "font_size": room.get("font_size", 16),
        "presentation_mode": room.get("presentation_mode", False)
    }

# Playlist/Repertoire Management
@api_router.post("/rooms/{room_id}/playlist/add/{song_id}")
async def add_song_to_playlist(
    room_id: str,
    song_id: str,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can manage playlist")
    
    # Check if song exists
    song = await db.songs.find_one({"id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Add to playlist if not already there
    current_playlist = room.get("playlist", [])
    if song_id not in current_playlist:
        current_playlist.append(song_id)
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {"playlist": current_playlist}}
        )
        
        # Smart playlist management
        if not room.get("current_song_id"):
            # No current song, set this as current and next as the second song
            await db.rooms.update_one(
                {"id": room_id},
                {"$set": {
                    "current_song_id": song_id,
                    "next_song_id": current_playlist[1] if len(current_playlist) > 1 else None
                }}
            )
        elif not room.get("next_song_id") and song_id != room.get("current_song_id"):
            # Set as next song
            await db.rooms.update_one(
                {"id": room_id},
                {"$set": {"next_song_id": song_id}}
            )
        else:
            # Update next song to always show upcoming song in playlist
            current_song_id = room.get("current_song_id")
            if current_song_id in current_playlist:
                current_index = current_playlist.index(current_song_id)
                next_index = (current_index + 1) % len(current_playlist)
                next_song_id = current_playlist[next_index] if len(current_playlist) > 1 else None
                
                await db.rooms.update_one(
                    {"id": room_id},
                    {"$set": {"next_song_id": next_song_id}}
                )
        
        # Emit real-time update
        await sio.emit('playlist_updated', {
            'action': 'song_added',
            'song_id': song_id,
            'song_title': song["title"],
            'artist': song["artist"],
            'updated_by': current_user.name
        }, room=room_id)
    
    return {"message": "Song added to playlist", "playlist_length": len(current_playlist)}

@api_router.get("/rooms/{room_id}/playlist")
async def get_playlist(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    playlist_songs = []
    for song_id in room.get("playlist", []):
        song = await db.songs.find_one({"id": song_id})
        if song:
            playlist_songs.append(Song(**song))
    
    return {
        "playlist": playlist_songs,
        "current_song_id": room.get("current_song_id"),
        "next_song_id": room.get("next_song_id")
    }

@api_router.delete("/rooms/{room_id}/playlist/{song_id}")
async def remove_song_from_playlist(
    room_id: str,
    song_id: str,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can manage playlist")
    
    current_playlist = room.get("playlist", [])
    if song_id in current_playlist:
        current_playlist.remove(song_id)
        
        update_data = {"playlist": current_playlist}
        
        # If removing current song, advance to next
        if room.get("current_song_id") == song_id:
            next_song = current_playlist[0] if current_playlist else None
            update_data["current_song_id"] = next_song
            update_data["next_song_id"] = current_playlist[1] if len(current_playlist) > 1 else None
        
        # If removing next song, set new next
        elif room.get("next_song_id") == song_id:
            current_index = current_playlist.index(room.get("current_song_id")) if room.get("current_song_id") in current_playlist else -1
            next_index = current_index + 1 if current_index >= 0 else 0
            update_data["next_song_id"] = current_playlist[next_index] if next_index < len(current_playlist) else None
        
        await db.rooms.update_one({"id": room_id}, {"$set": update_data})
        
        # Emit real-time update
        await sio.emit('playlist_updated', {
            'action': 'song_removed',
            'song_id': song_id,
            'updated_by': current_user.name
        }, room=room_id)
    
    return {"message": "Song removed from playlist"}

@api_router.post("/rooms/{room_id}/playlist/next")
async def next_song_in_playlist(
    room_id: str,
    current_user: User = Depends(get_current_user)
):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["admin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin can control playlist")
    
    playlist = room.get("playlist", [])
    current_song_id = room.get("current_song_id")
    
    if not playlist:
        raise HTTPException(status_code=400, detail="Playlist is empty")
    
    try:
        current_index = playlist.index(current_song_id) if current_song_id else -1
        next_index = (current_index + 1) % len(playlist)
        next_next_index = (next_index + 1) % len(playlist)
        
        new_current = playlist[next_index]
        # Always set next song if playlist has more than 1 song
        new_next = playlist[next_next_index] if len(playlist) > 1 else playlist[0] if len(playlist) == 1 else None
        
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {
                "current_song_id": new_current,
                "next_song_id": new_next
            }}
        )
        
        # Get song info for notification
        song = await db.songs.find_one({"id": new_current})
        
        # Emit real-time update
        await sio.emit('playlist_updated', {
            'action': 'song_changed',
            'new_current_song_id': new_current,
            'new_next_song_id': new_next,
            'song_title': song["title"] if song else "Unknown",
            'artist': song["artist"] if song else "Unknown",
            'updated_by': current_user.name
        }, room=room_id)
        
        return {"message": "Advanced to next song", "current_song_id": new_current}
        
    except ValueError:
        # Current song not in playlist, just start from beginning
        new_current = playlist[0]
        new_next = playlist[1] if len(playlist) > 1 else None
        
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {
                "current_song_id": new_current,
                "next_song_id": new_next
            }}
        )
        
        return {"message": "Started playlist from beginning", "current_song_id": new_current}

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

# Return the socket app instead of regular app
app_final = socket_app