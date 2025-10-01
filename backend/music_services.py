import spotipy
import aiohttp
import asyncio
import lyricsgenius
import json
import os
import logging
import hashlib
from spotipy.oauth2 import SpotifyClientCredentials
from typing import Dict, List, Optional, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
import concurrent.futures
import threading

class MusicAPIService:
    def __init__(self, cache_service=None):
        # Spotify
        self.spotify_client_id = os.getenv('SPOTIFY_CLIENT_ID')
        self.spotify_client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        
        # AUdD
        self.audd_token = os.getenv('AUDD_API_TOKEN')
        
        # Genius
        self.genius_access_token = os.getenv('GENIUS_ACCESS_TOKEN')
        
        # Emergency LLM
        self.llm_key = os.getenv('EMERGENT_LLM_KEY')
        
        # Cache service
        self.cache_service = cache_service
        
        # Thread pool for parallel processing
        self.thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=3)
        
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
        Fast comprehensive song search with caching and parallel processing
        """
        # Check cache first
        if self.cache_service:
            cached_result = await self.cache_service.get_cached_result(
                "song_search",
                {"title": title.lower(), "artist": artist.lower()},
                max_age_hours=168  # 7 days for songs
            )
            if cached_result:
                logging.info(f"Cache hit for {title} by {artist}")
                return cached_result
        
        # Default result structure
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
            # Run API calls in parallel for speed
            tasks = []
            
            # 1. Spotify search (fast)
            spotify_task = asyncio.create_task(self._search_spotify(title, artist))
            tasks.append(("spotify", spotify_task))
            
            # 2. Genius search (can be slow, run in parallel)
            genius_task = asyncio.create_task(self._get_lyrics_genius(title, artist))
            tasks.append(("genius", genius_task))
            
            # Wait for fast results first (Spotify)
            spotify_data = await spotify_task
            if spotify_data:
                result.update(spotify_data)
            
            # Wait for Genius with timeout
            try:
                genius_data = await asyncio.wait_for(genius_task, timeout=5.0)
                if genius_data:
                    result.update(genius_data)
            except asyncio.TimeoutError:
                logging.warning(f"Genius API timeout for {title} by {artist}")
            
            # 3. Generate AI fallback if needed (only for missing chords)
            if not result.get("chords") or not result.get("lyrics"):
                ai_data = await self._generate_ai_fallback_fast(title, artist, result)
                result.update(ai_data)
            
            # Cache the result
            if self.cache_service:
                await self.cache_service.set_cached_result(
                    "song_search",
                    {"title": title.lower(), "artist": artist.lower()},
                    result
                )
            
            return result
            
        except Exception as e:
            logging.error(f"Error in comprehensive search: {e}")
            # Fast fallback
            return await self._generate_ai_fallback_fast(title, artist, result)

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

    async def _generate_ai_fallback_fast(self, title: str, artist: str, existing_data: Dict) -> Dict[str, Any]:
        """Generate AI-powered content with optimizations for speed"""
        # Check cache first for AI results
        if self.cache_service:
            cached_ai = await self.cache_service.get_cached_result(
                "ai_fallback",
                {"title": title.lower(), "artist": artist.lower()},
                max_age_hours=72  # 3 days for AI results
            )
            if cached_ai:
                return cached_ai
        
        try:
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"fast_music_{hashlib.md5(f'{title}{artist}'.encode()).hexdigest()[:8]}",
                system_message="Você é um músico profissional. Responda de forma rápida e concisa."
            ).with_model("openai", "gpt-5")
            
            # Shorter, more focused prompt for speed
            message = UserMessage(
                text=f"""Música: "{title}" de "{artist}"
                
                Responda APENAS JSON válido com cifras básicas:
                {{
                    "lyrics_with_chords": "[Verso 1]\\n     C              G              Am             F\\n(Letra básica com acordes posicionados)",
                    "chords": "C - G - Am - F",
                    "key": "C",
                    "genre": "Popular", 
                    "tempo": 120
                }}
                
                Seja RÁPIDO, use estrutura simples."""
            )
            
            # Set timeout for AI call
            response = await asyncio.wait_for(
                chat.send_message(message), 
                timeout=8.0  # 8 second timeout
            )
            
            try:
                ai_data = json.loads(response)
                result = {
                    "lyrics": ai_data.get("lyrics_with_chords", self._get_basic_structure(title, artist)),
                    "chords": ai_data.get("chords", "C - G - Am - F"),
                    "key": ai_data.get("key", "C"),
                    "genre": ai_data.get("genre", "Popular"),
                    "tempo": ai_data.get("tempo", 120),
                    "structure": "Verso - Refrão"
                }
                
                # Cache AI result
                if self.cache_service:
                    await self.cache_service.set_cached_result(
                        "ai_fallback",
                        {"title": title.lower(), "artist": artist.lower()},
                        result
                    )
                
                return result
                
            except json.JSONDecodeError:
                logging.warning("AI returned invalid JSON, using basic fallback")
                return self._get_basic_structure(title, artist)
                
        except asyncio.TimeoutError:
            logging.warning(f"AI timeout for {title} by {artist}, using basic fallback")
            return self._get_basic_structure(title, artist)
        except Exception as e:
            logging.error(f"AI fallback error: {e}")
            return self._get_basic_structure(title, artist)
    
    def _get_basic_structure(self, title: str, artist: str) -> Dict[str, Any]:
        """Ultra-fast basic structure when all else fails"""
        return {
            "lyrics": f"[Verso 1]\n     C              G              Am             F\n{title} - {artist}\n     C              G              F              G\nEstrutura básica para ensaio\n\n[Refrão]\n     F              C              G              Am\nRefrão de {title}\n     F              C              G              C\nConsulte fontes oficiais",
            "chords": "C - G - Am - F",
            "key": "C",
            "genre": "Popular",
            "tempo": 120,
            "structure": "Verso - Refrão"
        }

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
        """Fast intelligent search with caching"""
        # Check cache first
        if self.cache_service:
            cached_results = await self.cache_service.get_cached_result(
                "intelligent_search",
                {"query": query.lower()},
                max_age_hours=24  # Cache searches for 24 hours
            )
            if cached_results:
                logging.info(f"Cache hit for intelligent search: {query}")
                return cached_results
        
        results = []
        
        try:
            # Spotify search is usually fast
            if self.spotify:
                try:
                    spotify_results = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            self.thread_pool,
                            lambda: self.spotify.search(q=query, type='track', limit=8)
                        ),
                        timeout=3.0  # 3 second timeout for Spotify
                    )
                    
                    for track in spotify_results['tracks']['items']:
                        results.append({
                            "title": track['name'],
                            "artist": track['artists'][0]['name'],
                            "genre": "Popular",
                            "year": track['album']['release_date'][:4] if track['album']['release_date'] else "Unknown",
                            "popularity": min(10, max(1, track['popularity'] // 10)),  # 1-10 scale
                            "album": track['album']['name'],
                            "preview_url": track['preview_url']
                        })
                        
                except asyncio.TimeoutError:
                    logging.warning("Spotify search timeout")
            
            # Only use AI if Spotify failed or returned few results
            if len(results) < 3:
                try:
                    ai_results = await asyncio.wait_for(
                        self._ai_intelligent_search_fast(query),
                        timeout=5.0  # 5 second timeout for AI
                    )
                    results.extend(ai_results)
                except asyncio.TimeoutError:
                    logging.warning("AI search timeout")
            
            # Limit and cache results
            final_results = results[:8]
            
            if self.cache_service and final_results:
                await self.cache_service.set_cached_result(
                    "intelligent_search",
                    {"query": query.lower()},
                    final_results
                )
            
            return final_results
            
        except Exception as e:
            logging.error(f"Intelligent search error: {e}")
            # Return basic fallback
            return [
                {
                    "title": f"Busca por: {query}",
                    "artist": "Resultados não encontrados",
                    "genre": "Unknown",
                    "year": "2024",
                    "popularity": 5
                }
            ]

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