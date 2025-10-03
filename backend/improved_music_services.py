import asyncio
import logging
import hashlib
import json
import os
from typing import Dict, List, Optional, Any, Tuple
from emergentintegrations.llm.chat import LlmChat, UserMessage
from datetime import datetime, timezone

class ImprovedMusicService:
    """
    Serviço aprimorado de música com fallback por IA e cache inteligente
    """
    
    def __init__(self, cache_service=None):
        self.cache_service = cache_service
        self.llm_key = os.getenv('EMERGENT_LLM_KEY')
        
        # Cache de letras conhecidas (fallback quando APIs falham)
        self.lyrics_database = {
            "imagine": """
            Imagine there's no heaven
            It's easy if you try
            No hell below us
            Above us only sky
            Imagine all the people living for today
            
            Imagine there's no countries
            It isn't hard to do
            Nothing to kill or die for
            And no religion too
            Imagine all the people living life in peace
            
            You may say I'm a dreamer
            But I'm not the only one
            I hope someday you'll join us
            And the world will be as one
            
            Imagine no possessions
            I wonder if you can
            No need for greed or hunger
            A brotherhood of man
            Imagine all the people sharing all the world
            
            You may say I'm a dreamer
            But I'm not the only one
            I hope someday you'll join us
            And the world will be as one
            """,
            "yesterday": """
            Yesterday, all my troubles seemed so far away
            Now it looks as though they're here to stay
            Oh, I believe in yesterday
            
            Suddenly, I'm not half the man I used to be
            There's a shadow hanging over me
            Oh, yesterday came suddenly
            
            Why she had to go I don't know, she wouldn't say
            I said something wrong, now I long for yesterday
            
            Yesterday, love was such an easy game to play
            Now I need a place to hide away
            Oh, I believe in yesterday
            
            Why she had to go I don't know, she wouldn't say
            I said something wrong, now I long for yesterday
            
            Yesterday, love was such an easy game to play
            Now I need a place to hide away
            Oh, I believe in yesterday
            """,
            "let_it_be": """
            When I find myself in times of trouble
            Mother Mary comes to me
            Speaking words of wisdom, let it be
            
            And in my hour of darkness
            She is standing right in front of me
            Speaking words of wisdom, let it be
            
            Let it be, let it be
            Let it be, let it be
            Whisper words of wisdom, let it be
            
            And when the broken-hearted people
            Living in the world agree
            There will be an answer, let it be
            
            For though they may be parted
            There is still a chance that they will see
            There will be an answer, let it be
            
            Let it be, let it be
            Let it be, let it be
            Yeah, there will be an answer, let it be
            
            Let it be, let it be
            Let it be, let it be
            Whisper words of wisdom, let it be
            """
        }
        
        # Base de dados de acordes conhecidos
        self.chords_database = {
            "imagine": "C Cmaj7 F Am Dm G C/E G7",
            "yesterday": "F Em A Dm Bb C F G7 C7",
            "let_it_be": "C G Am F C G F C/E Dm C"
        }
    
    async def search_song_enhanced(self, query: str, artist: str = "") -> Dict[str, Any]:
        """
        Busca aprimorada de música com múltiplos fallbacks
        """
        cache_key = f"song_enhanced_{hashlib.md5(f'{query}_{artist}'.encode()).hexdigest()}"
        
        # Verificar cache primeiro
        if self.cache_service:
            try:
                cached_result = await self.cache_service.get(cache_key)
                if cached_result:
                    logging.info(f"Cache hit for song search: {query}")
                    return json.loads(cached_result)
            except Exception as e:
                logging.warning(f"Cache error: {e}")
        
        # Normalizar query para busca no banco local
        normalized_query = query.lower().replace(" ", "_").replace("-", "_")
        
        # Buscar primeiro no banco local (mais rápido)
        local_result = self._search_local_database(normalized_query, artist)
        if local_result:
            await self._cache_result(cache_key, local_result)
            return local_result
        
        # Se não encontrou, usar IA para gerar
        ai_result = await self._generate_song_by_ai(query, artist)
        if ai_result:
            await self._cache_result(cache_key, ai_result)
            return ai_result
        
        # Fallback final
        return self._create_fallback_song(query, artist)
    
    def _search_local_database(self, query: str, artist: str) -> Optional[Dict[str, Any]]:
        """
        Busca na base local de letras e acordes
        """
        # Buscar letras conhecidas
        for key, lyrics in self.lyrics_database.items():
            if query in key or key in query:
                chords = self.chords_database.get(key, "C F G Am")
                
                return {
                    "title": query.replace("_", " ").title(),
                    "artist": artist or "Artista Desconhecido",
                    "lyrics": lyrics.strip(),
                    "chords": chords,
                    "genre": "Rock/Pop",
                    "key": "C",
                    "bpm": 120,
                    "duration": 240,
                    "source": "local_database"
                }
        
        return None
    
    async def _generate_song_by_ai(self, title: str, artist: str) -> Optional[Dict[str, Any]]:
        """
        Gera informações da música usando IA
        """
        try:
            if not self.llm_key:
                return None
                
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"song_gen_{hashlib.md5(f'{title}_{artist}'.encode()).hexdigest()}",
                system_message="""Você é um especialista em música. Forneça informações REAIS sobre músicas quando possível. 
                Se a música não existir, seja criativo mas indique claramente que é uma criação."""
            ).with_model("openai", "gpt-5")
            
            message = UserMessage(text=f"""
            Preciso de informações sobre a música "{title}" do artista "{artist}".
            
            Forneça no seguinte formato JSON:
            {{
                "title": "Título da música",
                "artist": "Nome do artista",
                "lyrics": "Letra completa da música em português ou inglês",
                "chords": "Sequência de acordes principais (ex: C F G Am)",
                "genre": "Gênero musical",
                "key": "Tom da música (ex: C, G, F)",
                "bpm": 120,
                "duration": 240,
                "source": "ai_generated"
            }}
            
            Se a música existir na vida real, use as informações reais. Caso contrário, crie uma música inspirada no título/artista.
            """)
            
            response = await chat.send_message(message)
            
            # Tentar extrair JSON da resposta
            try:
                # Buscar JSON na resposta
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    song_data = json.loads(json_match.group())
                    song_data["source"] = "ai_generated"
                    return song_data
            except Exception as e:
                logging.error(f"Error parsing AI JSON response: {e}")
            
            # Se não conseguiu extrair JSON, criar manualmente
            return {
                "title": title,
                "artist": artist,
                "lyrics": self._extract_lyrics_from_text(response),
                "chords": "C F G Am Dm",
                "genre": "Criação IA",
                "key": "C",
                "bpm": 120,
                "duration": 240,
                "source": "ai_generated"
            }
            
        except Exception as e:
            logging.error(f"Error generating song by AI: {e}")
            return None
    
    def _extract_lyrics_from_text(self, text: str) -> str:
        """
        Extrai letras de um texto gerado por IA
        """
        # Tentar encontrar letras no texto
        lines = text.split('\n')
        lyrics_lines = []
        
        for line in lines:
            line = line.strip()
            # Pular linhas que são claramente metadados
            if any(word in line.lower() for word in ['json', '{', '}', 'bpm', 'genre', 'key', 'duration']):
                continue
            if line and not line.startswith('#') and not line.startswith('*'):
                lyrics_lines.append(line)
        
        if lyrics_lines:
            return '\n'.join(lyrics_lines[:20])  # Limitar a 20 linhas
        else:
            return f"Letra da música {text[:100]}..." if len(text) > 100 else text
    
    def _create_fallback_song(self, title: str, artist: str) -> Dict[str, Any]:
        """
        Cria uma música básica como último recurso
        """
        return {
            "title": title,
            "artist": artist,
            "lyrics": f"""
            Esta é a música "{title}"
            Do artista {artist}
            
            Letra não disponível no momento
            Mas a música continua tocando
            Em nossos corações
            
            {title}, {title}
            Uma canção especial
            Para nossa banda tocar
            """,
            "chords": "C F G Am F C G C",
            "genre": "Popular",
            "key": "C",
            "bpm": 120,
            "duration": 180,
            "source": "fallback"
        }
    
    async def _cache_result(self, cache_key: str, result: Dict[str, Any]):
        """
        Cache com TTL mais longo para resultados gerados por IA
        """
        if self.cache_service:
            try:
                ttl = 86400 if result.get("source") in ["ai_generated", "local_database"] else 3600
                await self.cache_service.set(cache_key, json.dumps(result), ttl)
            except Exception as e:
                logging.warning(f"Cache set error: {e}")
    
    async def generate_ai_repertoire_fast(self, room_id: str, genre: str, song_count: int = 10) -> List[Dict[str, Any]]:
        """
        Geração rápida de repertório por IA com cache agressivo
        """
        cache_key = f"ai_repertoire_{hashlib.md5(f'{genre}_{song_count}'.encode()).hexdigest()}"
        
        # Cache com TTL longo para repertórios
        if self.cache_service:
            try:
                cached_repertoire = await self.cache_service.get(cache_key)
                if cached_repertoire:
                    logging.info(f"Fast repertoire cache hit for genre: {genre}")
                    return json.loads(cached_repertoire)
            except Exception as e:
                logging.warning(f"Cache error: {e}")
        
        # Gerar repertório por IA
        repertoire = await self._generate_repertoire_by_ai(genre, song_count)
        
        # Cache por 1 semana
        if self.cache_service and repertoire:
            try:
                await self.cache_service.set(cache_key, json.dumps(repertoire), 604800)
            except Exception as e:
                logging.warning(f"Cache set error: {e}")
        
        return repertoire
    
    async def _generate_repertoire_by_ai(self, genre: str, song_count: int) -> List[Dict[str, Any]]:
        """
        Gera repertório completo usando IA
        """
        try:
            if not self.llm_key:
                return self._create_default_repertoire(genre, song_count)
                
            chat = LlmChat(
                api_key=self.llm_key,
                session_id=f"repertoire_{hashlib.md5(f'{genre}_{song_count}'.encode()).hexdigest()}",
                system_message="""Você é um especialista em música que cria repertórios para bandas. 
                Sugira músicas REAIS e populares que são adequadas para apresentações ao vivo."""
            ).with_model("openai", "gpt-5")
            
            message = UserMessage(text=f"""
            Crie um repertório de {song_count} músicas do gênero {genre} para uma banda tocar.
            
            Para cada música, forneça:
            - Título da música (REAL, se possível)
            - Artista original
            - Tom sugerido para apresentação
            - BPM aproximado
            - Acordes principais
            
            Priorize músicas conhecidas e populares que o público reconheça.
            Formato de resposta: uma música por linha, no formato:
            "Título - Artista | Tom: X | BPM: Y | Acordes: acordes"
            """)
            
            response = await chat.send_message(message)
            return self._parse_ai_repertoire_response(response, genre)
            
        except Exception as e:
            logging.error(f"Error generating AI repertoire: {e}")
            return self._create_default_repertoire(genre, song_count)
    
    def _parse_ai_repertoire_response(self, response: str, genre: str) -> List[Dict[str, Any]]:
        """
        Processa resposta da IA para criar lista de músicas
        """
        songs = []
        lines = response.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            try:
                # Tentar parsear formato: "Título - Artista | Tom: X | BPM: Y | Acordes: acordes"
                if '|' in line and '-' in line:
                    parts = line.split('|')
                    title_artist = parts[0].strip()
                    
                    if '-' in title_artist:
                        title, artist = title_artist.split('-', 1)
                        title = title.strip().strip('"').strip("'")
                        artist = artist.strip().strip('"').strip("'")
                        
                        # Extrair informações adicionais
                        key = "C"
                        bpm = 120
                        chords = "C F G Am"
                        
                        for part in parts[1:]:
                            part = part.strip().lower()
                            if part.startswith('tom:') or part.startswith('key:'):
                                key = part.split(':', 1)[1].strip().upper()
                            elif part.startswith('bpm:'):
                                try:
                                    bpm = int(part.split(':', 1)[1].strip())
                                except:
                                    bpm = 120
                            elif part.startswith('acorde') or part.startswith('chord'):
                                chords = part.split(':', 1)[1].strip()
                        
                        song = {
                            "title": title,
                            "artist": artist,
                            "key": key,
                            "bpm": bpm,
                            "chords": chords,
                            "genre": genre,
                            "lyrics": f"Letra da música '{title}' por {artist}",
                            "duration": 240,
                            "source": "ai_repertoire"
                        }
                        songs.append(song)
                        
                        if len(songs) >= 10:  # Limitar
                            break
                            
            except Exception as e:
                logging.warning(f"Error parsing repertoire line: {line} - {e}")
                continue
        
        return songs if songs else self._create_default_repertoire(genre, 5)
    
    def _create_default_repertoire(self, genre: str, count: int) -> List[Dict[str, Any]]:
        """
        Repertório padrão quando IA não está disponível
        """
        default_songs = [
            {"title": "Imagine", "artist": "John Lennon", "key": "C", "bpm": 76},
            {"title": "Yesterday", "artist": "The Beatles", "key": "F", "bpm": 98},
            {"title": "Let It Be", "artist": "The Beatles", "key": "C", "bpm": 73},
            {"title": "Wonderwall", "artist": "Oasis", "key": "Em", "bpm": 87},
            {"title": "Redemption Song", "artist": "Bob Marley", "key": "G", "bpm": 76},
            {"title": "Tears in Heaven", "artist": "Eric Clapton", "key": "A", "bpm": 80},
            {"title": "Mad World", "artist": "Gary Jules", "key": "Em", "bpm": 84},
            {"title": "Black", "artist": "Pearl Jam", "key": "E", "bpm": 69},
            {"title": "Creep", "artist": "Radiohead", "key": "G", "bpm": 92},
            {"title": "Hallelujah", "artist": "Leonard Cohen", "key": "C", "bpm": 60}
        ]
        
        repertoire = []
        for i, song in enumerate(default_songs[:count]):
            repertoire.append({
                "title": song["title"],
                "artist": song["artist"],
                "key": song["key"],
                "bpm": song["bpm"],
                "chords": "C F G Am Dm G7",
                "genre": genre,
                "lyrics": f"Letra da música '{song['title']}' por {song['artist']}",
                "duration": 240,
                "source": "default_repertoire"
            })
        
        return repertoire