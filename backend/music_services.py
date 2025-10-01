import spotipy
import aiohttp
import asyncio
import lyricsgenius
import json
import os
import logging
from spotipy.oauth2 import SpotifyClientCredentials
from typing import Dict, List, Optional, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
import concurrent.futures
import threading

class MusicAPIService:
    def __init__(self):
        # Spotify
        self.spotify_client_id = os.getenv('SPOTIFY_CLIENT_ID')
        self.spotify_client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        
        # AUdD
        self.audd_token = os.getenv('AUDD_API_TOKEN')
        
        # Genius
        self.genius_access_token = os.getenv('GENIUS_ACCESS_TOKEN')
        
        # Emergency LLM
        self.llm_key = os.getenv('EMERGENT_LLM_KEY')
        
        # Initialize services
        self._init_spotify()
        self._init_genius()
    
    def _init_spotify(self):
        """Initialize Spotify client"""
        try:
            if self.spotify_client_id and self.spotify_client_secret:
                auth_manager = SpotifyClientCredentials(
                    client_id=self.spotify_client_id,
                    client_secret=self.spotify_client_secret
                )
                self.spotify = spotipy.Spotify(auth_manager=auth_manager)
                logging.info("Spotify client initialized successfully")
            else:
                self.spotify = None
                logging.warning("Spotify credentials not found")
        except Exception as e:
            logging.error(f"Error initializing Spotify: {e}")
            self.spotify = None
    
    def _init_genius(self):
        """Initialize Genius client"""
        try:
            if self.genius_access_token:
                self.genius = lyricsgenius.Genius(self.genius_access_token)
                self.genius.timeout = 15
                self.genius.verbose = False
                logging.info("Genius client initialized successfully")
            else:
                self.genius = None
                logging.warning("Genius access token not found")
        except Exception as e:
            logging.error(f"Error initializing Genius: {e}")
            self.genius = None

    async def search_song_comprehensive(self, title: str, artist: str) -> Dict[str, Any]:
        """
        Comprehensive song search using multiple APIs
        """
        result = {
            "title": title,
            "artist": artist,
            "lyrics": None,
            "chords": None,
            "key": "C",
            "genre": "Unknown",
            "tempo": 120,
            "structure": "Verse - Chorus",
            "spotify_data": None,
            "preview_url": None,
            "popularity": 0,
            "release_date": None,
            "album": None,
            "duration_ms": None,
            "audio_features": None
        }
        
        try:
            # 1. Search Spotify for accurate metadata
            spotify_data = await self._search_spotify(title, artist)
            if spotify_data:
                result.update(spotify_data)
            
            # 2. Get lyrics from Genius
            lyrics_data = await self._get_lyrics_genius(title, artist)
            if lyrics_data:
                result.update(lyrics_data)
            
            # 3. If no real data found, use AI as fallback
            if not result["lyrics"] or not result["chords"]:
                ai_data = await self._generate_ai_fallback(title, artist, result)
                result.update(ai_data)
            
            return result
            
        except Exception as e:
            logging.error(f"Error in comprehensive search: {e}")
            # Fallback to AI if all APIs fail
            return await self._generate_ai_fallback(title, artist, result)

    async def _search_spotify(self, title: str, artist: str) -> Optional[Dict[str, Any]]:
        """Search Spotify for song metadata"""
        if not self.spotify:
            return None
        
        try:
            # Search for the track
            query = f'track:"{title}" artist:"{artist}"'
            results = self.spotify.search(q=query, type='track', limit=1)
            
            if results['tracks']['items']:
                track = results['tracks']['items'][0]
                
                # Get audio features
                audio_features = None
                try:
                    audio_features = self.spotify.audio_features(track['id'])[0]
                except:
                    pass
                
                # Extract data
                spotify_data = {
                    "title": track['name'],
                    "artist": track['artists'][0]['name'],
                    "album": track['album']['name'],
                    "release_date": track['album']['release_date'],
                    "popularity": track['popularity'],
                    "preview_url": track['preview_url'],
                    "duration_ms": track['duration_ms'],
                    "spotify_data": track,
                    "genre": track['album'].get('genres', ['Unknown'])[0] if track['album'].get('genres') else "Unknown"
                }
                
                if audio_features:
                    spotify_data.update({
                        "tempo": int(audio_features['tempo']),
                        "key": self._convert_spotify_key(audio_features['key']),
                        "audio_features": audio_features
                    })
                
                logging.info(f"Found Spotify data for {title} by {artist}")
                return spotify_data
                
        except Exception as e:
            logging.error(f"Spotify search error: {e}")
        
        return None

    async def _get_lyrics_genius(self, title: str, artist: str) -> Optional[Dict[str, Any]]:
        """Get lyrics from Genius"""
        if not self.genius:
            return None
        
        try:
            # Search for song
            song = self.genius.search_song(title, artist)
            
            if song and song.lyrics:
                # Clean up lyrics
                lyrics = song.lyrics
                
                # Remove [Verse], [Chorus] markers for now - we'll add them back with AI
                lyrics_clean = lyrics.replace('[', '\n[').replace(']', ']\n')
                
                return {
                    "lyrics": lyrics_clean,
                    "genius_url": song.url,
                    "artist": song.artist
                }
                
        except Exception as e:
            logging.error(f"Genius lyrics error: {e}")
        
        return None

    async def _generate_ai_fallback(self, title: str, artist: str, existing_data: Dict) -> Dict[str, Any]:
        """Generate AI-powered chord charts and missing data"""
        try:
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"music_ai_{title}_{artist}",
                system_message="Você é um músico profissional especializado em criar cifras e arranjos musicais precisos."
            ).with_model("openai", "gpt-5")
            
            # Build context from existing data
            context = f"""
            Música: "{title}" de "{artist}"
            Dados existentes:
            - Tom: {existing_data.get('key', 'C')}
            - Gênero: {existing_data.get('genre', 'Unknown')}
            - BPM: {existing_data.get('tempo', 120)}
            - Álbum: {existing_data.get('album', 'Unknown')}
            """
            
            if existing_data.get('lyrics'):
                context += f"- Letra disponível: Sim\n"
            else:
                context += f"- Letra disponível: Não\n"
            
            message = UserMessage(
                text=f"""{context}

                Crie uma transcrição musical profissional com:
                
                1. CIFRAS COMPLETAS formatadas assim:
                [Intro]
                C - G - Am - F
                
                [Verso 1]
                     C              G              Am             F
                (posicione os acordes exatamente sobre as sílabas)
                
                [Refrão]
                     F              C              G              Am
                (continue o padrão)
                
                2. Se a LETRA não estiver disponível, crie uma letra simples mas realista
                
                3. SEQUÊNCIA DE ACORDES principais da música
                
                4. Confirme ou corrija: TOM, GÊNERO, BPM
                
                Responda APENAS em JSON válido:
                {{
                    "lyrics_with_chords": "letra completa com cifras posicionadas",
                    "chords": "sequência de acordes principais",
                    "key": "tom da música",
                    "genre": "gênero específico", 
                    "tempo": bpm_numerico,
                    "structure": "estrutura da música"
                }}"""
            )
            
            response = await chat.send_message(message)
            
            try:
                ai_data = json.loads(response)
                return {
                    "lyrics": ai_data.get("lyrics_with_chords", existing_data.get("lyrics", "Letra não disponível")),
                    "chords": ai_data.get("chords", "C - G - Am - F"),
                    "key": ai_data.get("key", existing_data.get("key", "C")),
                    "genre": ai_data.get("genre", existing_data.get("genre", "Popular")),
                    "tempo": ai_data.get("tempo", existing_data.get("tempo", 120)),
                    "structure": ai_data.get("structure", "Verse - Chorus")
                }
            except json.JSONDecodeError:
                logging.error("AI returned invalid JSON")
                return self._default_fallback(title, artist)
                
        except Exception as e:
            logging.error(f"AI fallback error: {e}")
            return self._default_fallback(title, artist)

    def _default_fallback(self, title: str, artist: str) -> Dict[str, Any]:
        """Last resort fallback data"""
        return {
            "lyrics": f"[Verso 1]\n     C              G              Am             F\nLetra da música '{title}' de '{artist}'\n     C              G              F              G\nConsulte fontes oficiais para letra completa",
            "chords": "C - G - Am - F",
            "key": "C",
            "genre": "Popular",
            "tempo": 120,
            "structure": "Verso - Refrão"
        }

    def _convert_spotify_key(self, key_number: int) -> str:
        """Convert Spotify key number to musical key"""
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        return keys[key_number] if 0 <= key_number < 12 else 'C'

    async def intelligent_search(self, query: str) -> List[Dict[str, Any]]:
        """AI + Spotify powered search"""
        results = []
        
        try:
            # First try Spotify search
            if self.spotify:
                spotify_results = self.spotify.search(q=query, type='track', limit=8)
                
                for track in spotify_results['tracks']['items']:
                    results.append({
                        "title": track['name'],
                        "artist": track['artists'][0]['name'],
                        "genre": "Popular",  # Spotify doesn't always provide genre in search
                        "year": track['album']['release_date'][:4],
                        "popularity": track['popularity'] // 10,  # Convert to 1-10 scale
                        "album": track['album']['name'],
                        "preview_url": track['preview_url']
                    })
            
            # If Spotify didn't return enough results, use AI
            if len(results) < 3:
                ai_results = await self._ai_intelligent_search(query)
                results.extend(ai_results)
            
            return results[:8]  # Limit to 8 results
            
        except Exception as e:
            logging.error(f"Intelligent search error: {e}")
            # Fallback to AI only
            return await self._ai_intelligent_search(query)

    async def _ai_intelligent_search(self, query: str) -> List[Dict[str, Any]]:
        """AI-powered song search as fallback"""
        try:
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"search_{query}",
                system_message="Você é um especialista musical que encontra músicas baseado em consultas."
            ).with_model("openai", "gpt-5")
            
            message = UserMessage(
                text=f"""Baseado na busca: "{query}"
                
                Encontre até 6 músicas reais que correspondem. Pode ser por nome, artista, gênero ou descrição.
                
                Responda em formato JSON:
                [
                    {{
                        "title": "Nome Exato da Música",
                        "artist": "Nome do Artista",
                        "genre": "Gênero Musical",
                        "year": "Ano",
                        "popularity": 8
                    }}
                ]"""
            )
            
            response = await chat.send_message(message)
            return json.loads(response)
            
        except Exception as e:
            logging.error(f"AI search error: {e}")
            return []

    async def recognize_audio(self, audio_file_path: str) -> Optional[Dict[str, Any]]:
        """Recognize music from audio file using AUdD API"""
        if not self.audd_token:
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                with open(audio_file_path, 'rb') as audio_file:
                    data = aiohttp.FormData()
                    data.add_field('file', audio_file, filename='audio.mp3')
                    data.add_field('api_token', self.audd_token)
                    
                    async with session.post('https://api.audd.io/', data=data) as response:
                        if response.status == 200:
                            result = await response.json()
                            
                            if result['status'] == 'success' and result.get('result'):
                                track = result['result']
                                return {
                                    "title": track['title'],
                                    "artist": track['artist'],
                                    "album": track.get('album', ''),
                                    "release_date": track.get('release_date', ''),
                                    "recognition_source": "AUdD"
                                }
                                
        except Exception as e:
            logging.error(f"Audio recognition error: {e}")
        
        return None

# Initialize the service
music_service = MusicAPIService()