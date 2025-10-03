import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { 
  Music, 
  Users, 
  Plus, 
  Play, 
  SkipForward, 
  ArrowLeft, 
  Copy, 
  Search,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Settings,
  History,
  Zap,
  Gauge,
  Type
} from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';
import socketService from '../services/socket';
import IntelligentSearch from '../components/IntelligentSearch';
import AudioRecognition from '../components/AudioRecognition';
import RecommendationsDialog from '../components/RecommendationsDialog';
import NextSongBar from '../components/NextSongBar';
import CollaborativeRecording from '../components/CollaborativeRecording';
import SimpleLetrasDisplay from '../components/SimpleLetrasDisplay';
import RepertoireHistory from '../components/RepertoireHistory';
import { SmartLoading } from '../components/LoadingStates';

const Room = () => {
  const { roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showIntelligentSearch, setShowIntelligentSearch] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showTranspose, setShowTranspose] = useState(false);
  const [showAIRepertoire, setShowAIRepertoire] = useState(false);
  const [showCollaborativeRecording, setShowCollaborativeRecording] = useState(false);
  const [showRepertoireHistory, setShowRepertoireHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSongTempo, setCurrentSongTempo] = useState(120);
  // New settings states
  const [currentTempo, setCurrentTempo] = useState(120);
  const [fontSize, setFontSize] = useState(16);
  const [roomSettings, setRoomSettings] = useState({});
  const [playlist, setPlaylist] = useState([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  const [songForm, setSongForm] = useState({
    title: '',
    artist: ''
  });
  
  const [transposeForm, setTransposeForm] = useState({
    from_key: '',
    to_key: ''
  });
  
  const [aiRepertoireForm, setAiRepertoireForm] = useState({
    style: '',
    duration_minutes: 60,
    energy_level: 'media',
    audience_type: 'adultos'
  });

  // Available keys for transposition
  const musicalKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  useEffect(() => {
    loadRoomData();
    
    // Join room via WebSocket
    if (user && roomId) {
      socketService.joinRoom(roomId, user.id, user.name);
    }
    
    // Setup real-time listeners
    const handleUserJoined = (data) => {
      toast.success(`${data.user_name} entrou na sala`);
      loadRoomData(); // Refresh to show new member
    };
    
    const handleUserLeft = (data) => {
      toast.info(`Usuário saiu da sala`);
      loadRoomData(); // Refresh to remove member
    };
    
    const handleSongChanged = (data) => {
      toast.info('Música alterada pelo admin');
      loadRoomData(); // Refresh to show new song
    };
    
    const handleTransposeChanged = (data) => {
      toast.info(`Transposição alterada para ${data.new_key}`);
      loadRoomData(); // Refresh to show transposed content
    };
    
    socketService.onUserJoined(handleUserJoined);
    socketService.onUserLeft(handleUserLeft);
    socketService.onSongChanged(handleSongChanged);
    socketService.onTransposeChanged(handleTransposeChanged);
    
    // New event listeners
    const handlePlaylistLoaded = (data) => {
      toast.success(`📋 Repertório "${data.repertoire_name}" carregado por ${data.loaded_by}`);
      loadRoomData();
    };
    
    const handleTempoChanged = (data) => {
      toast.info(`🎵 Velocidade alterada: ${data.new_tempo} BPM por ${data.changed_by}`);
      setCurrentSongTempo(data.new_tempo);
    };
    
    socketService.onPlaylistLoaded(handlePlaylistLoaded);
    socketService.onTempoChanged(handleTempoChanged);
    
    return () => {
      // Leave room and cleanup
      if (user && roomId) {
        socketService.leaveRoom(roomId, user.id);
      }
      socketService.removeListener('user_joined', handleUserJoined);
      socketService.removeListener('user_left', handleUserLeft);
      socketService.removeListener('song_changed', handleSongChanged);
      socketService.removeListener('transpose_changed', handleTransposeChanged);
      socketService.removeListener('playlist_loaded', handlePlaylistLoaded);
      socketService.removeListener('tempo_changed', handleTempoChanged);
    };
  }, [roomId, user]);

  // Instrument notation loading removed - no longer needed for collaborative system

  useEffect(() => {
    loadRoomSettings();
    loadPlaylist();
  }, [roomId]);

  const loadRoomData = async () => {
    try {
      const data = await api.getRoom(roomId, token);
      setRoomData(data);
    } catch (error) {
      console.error('Error loading room:', error);
      toast.error('Erro ao carregar dados da sala');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const refreshRoomData = async () => {
    setRefreshing(true);
    await loadRoomData();
    setRefreshing(false);
    toast.success('Dados atualizados!');
  };

  // loadInstrumentNotation function removed - no longer needed for collaborative system

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!songForm.title.trim() || !songForm.artist.trim()) {
      toast.error('Por favor, preencha título e artista');
      return;
    }
    
    setLoading(true);
    try {
      // Show progress feedback
      toast.info('🔍 Buscando música no Spotify e Genius...');
      
      const song = await api.searchSong(songForm, token);
      
      // Show success and add to playlist
      toast.success(`✅ "${song.title}" encontrada! Adicionando à playlist...`);
      
      // Automatically add to playlist
      await handleAddToPlaylist(song);
      
      setSongForm({ title: '', artist: '' });
      setShowAddSong(false);
      
      toast.success(`🎵 "${song.title}" adicionada com cifras coordenadas!`);
      
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error('❌ Erro ao buscar música. Verifique o título e artista.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentSong = async (songId) => {
    try {
      await api.setCurrentSong(roomId, songId, token);
      toast.success('Música atual definida!');
      await loadRoomData();
    } catch (error) {
      console.error('Error setting current song:', error);
      toast.error('Erro ao definir música atual');
    }
  };

  const handleSetNextSong = async (songId) => {
    try {
      await api.setNextSong(roomId, songId, token);
      toast.success('Próxima música definida!');
      await loadRoomData();
    } catch (error) {
      console.error('Error setting next song:', error);
      toast.error('Erro ao definir próxima música');
    }
  };

  const loadRecommendations = async () => {
    try {
      const data = await api.getRecommendations(roomId, token);
      setRecommendations(data.recommendations);
      setShowRecommendations(true);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast.error('Erro ao carregar recomendações');
    }
  };

  const handleAddRecommendationsToPlaylist = async (selectedSongs) => {
    setLoading(true);
    try {
      for (const songText of selectedSongs) {
        // Parse "Title - Artist" format
        const [title, artist] = songText.split(' - ').map(s => s.trim());
        if (title && artist) {
          const song = await api.searchSong({ title, artist }, token);
          await handleAddToPlaylist(song);
        }
      }
      
      toast.success(`${selectedSongs.length} músicas adicionadas ao repertório!`);
      setShowRecommendations(false);
      await loadPlaylist();
    } catch (error) {
      console.error('Error adding recommendations:', error);
      toast.error('Erro ao adicionar recomendações');
    } finally {
      setLoading(false);
    }
  };

  const handleTranspose = async (e) => {
    e.preventDefault();
    if (!transposeForm.from_key || !transposeForm.to_key) {
      toast.error('Selecione ambos os tons');
      return;
    }
    
    if (transposeForm.from_key === transposeForm.to_key) {
      toast.error('Os tons devem ser diferentes');
      return;
    }
    
    try {
      await api.transposeRoom(roomId, transposeForm, token);
      toast.success(`Transposição realizada de ${transposeForm.from_key} para ${transposeForm.to_key}`);
      setShowTranspose(false);
      setTransposeForm({ from_key: '', to_key: '' });
      
      // Emit real-time update
      socketService.emitTransposeChange(roomId, transposeForm.to_key);
      
      // Refresh room data
      await loadRoomData();
    } catch (error) {
      console.error('Error transposing:', error);
      toast.error('Erro ao transpor repertório');
    }
  };

  const handleGenerateAIRepertoire = async (e) => {
    e.preventDefault();
    if (!aiRepertoireForm.style) {
      toast.error('Selecione o estilo musical');
      return;
    }
    
    setLoading(true);
    try {
      // Show immediate feedback
      toast.info('🤖 IA criando seu repertório personalizado...');
      
      const repertoire = await api.generateAIRepertoire(roomId, aiRepertoireForm, token);
      
      toast.success(`🎵 Repertório de ${repertoire.total_songs} músicas criado em segundos!`);
      setShowAIRepertoire(false);
      
      // Show repertoire in recommendations dialog
      setRecommendations(repertoire.repertoire.map(song => `${song.title} - ${song.artist}`));
      setShowRecommendations(true);
      
    } catch (error) {
      console.error('Error generating AI repertoire:', error);
      
      if (error.response?.status === 408) {
        toast.error('⏰ Geração do repertório demorou muito. Tente um estilo mais específico.');
      } else {
        toast.error('Erro ao gerar repertório pela IA');
      }
    } finally {
      setLoading(false);
    }
  };

  // Enhanced search with fallback
  const handleAddSongEnhanced = async (e) => {
    e.preventDefault();
    if (!songForm.title.trim()) {
      toast.error('Por favor, digite o título da música');
      return;
    }

    setLoading(true);
    try {
      toast.info('🔍 Buscando com sistema aprimorado...');
      
      const song = await api.searchSongEnhanced(songForm, token);
      
      if (song.source === 'local_database') {
        toast.success(`✅ Encontrada na base local: "${song.title}"`);
      } else if (song.source === 'ai_generated') {
        toast.success(`🤖 Gerada por IA: "${song.title}"`);
      } else {
        toast.success(`✅ "${song.title}" encontrada!`);
      }
      
      // Automatically add to playlist
      await handleAddToPlaylist(song);
      
      setSongForm({ title: '', artist: '' });
      setShowAddSong(false);
      
      toast.success(`🎵 "${song.title}" adicionada com letras!`);
      
    } catch (error) {
      console.error('Error with enhanced search:', error);
      toast.error('❌ Erro na busca aprimorada');
    } finally {
      setLoading(false);
    }
  };

  // Speed control functions
  const handleTempoChange = async (tempoChange) => {
    try {
      const response = await api.adjustRoomSpeed(roomId, tempoChange, token);
      setCurrentSongTempo(response.new_tempo);
      toast.success(`🎵 Velocidade ajustada: ${response.new_tempo} BPM`);
    } catch (error) {
      console.error('Error adjusting tempo:', error);
      toast.error('Erro ao ajustar velocidade');
    }
  };

  // Fast repertoire generation
  const handleGenerateRepertoireFast = async () => {
    try {
      setLoading(true);
      toast.info('🚀 Gerando repertório rapidamente...');
      
      const response = await api.generateRepertoireFast(roomId, {
        genre: 'Rock/Pop',
        song_count: 8
      }, token);
      
      toast.success(`✨ ${response.count} músicas geradas rapidamente!`);
      await loadRoomData();
      
    } catch (error) {
      console.error('Error generating fast repertoire:', error);
      toast.error('Erro na geração rápida');
    } finally {
      setLoading(false);
    }
  };

  // Old recording functions removed - replaced by CollaborativeRecording component

  const togglePresentationMode = async () => {
    const newMode = !presentationMode;
    try {
      await api.togglePresentationMode(roomId, newMode, token);
      setPresentationMode(newMode);
      toast.success(`Modo apresentação ${newMode ? 'ativado' : 'desativado'}`);
    } catch (error) {
      console.error('Error toggling presentation mode:', error);
      toast.error('Erro ao alterar modo apresentação');
    }
  };

  const loadRoomSettings = async () => {
    try {
      const settings = await api.getRoomSettings(roomId, token);
      setRoomSettings(settings);
      setCurrentTempo(settings.current_tempo || 120);
      setFontSize(settings.font_size || 16);
      setPresentationMode(settings.presentation_mode || false);
    } catch (error) {
      console.error('Error loading room settings:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      await api.updateRoomSettings(roomId, newSettings, token);
      await loadRoomSettings();
      toast.success('Configurações atualizadas!');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Erro ao atualizar configurações');
    }
  };

  const handleTempoSliderChange = (value) => {
    const newTempo = value[0];
    setCurrentTempo(newTempo);
    updateSettings({ tempo: newTempo });
  };

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    updateSettings({ font_size: newSize });
  };

  const handleKeyChange = (newKey) => {
    updateSettings({ key: newKey });
    setShowTranspose(false);
  };

  const loadPlaylist = async () => {
    try {
      const data = await api.getPlaylist(roomId, token);
      setPlaylist(data.playlist);
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  };

  const handleAddToPlaylist = async (song) => {
    try {
      await api.addSongToPlaylist(roomId, song.id, token);
      toast.success(`${song.title} adicionada à playlist!`);
      await loadPlaylist();
      await loadRoomData();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      toast.error('Erro ao adicionar à playlist');
    }
  };

  const handleRemoveFromPlaylist = async (songId) => {
    try {
      await api.removeSongFromPlaylist(roomId, songId, token);
      toast.success('Música removida da playlist!');
      await loadPlaylist();
      await loadRoomData();
    } catch (error) {
      console.error('Error removing from playlist:', error);
      toast.error('Erro ao remover da playlist');
    }
  };

  const handleNextSong = async () => {
    try {
      await api.nextSongInPlaylist(roomId, token);
      toast.success('Próxima música!');
      await loadRoomData();
    } catch (error) {
      console.error('Error advancing to next song:', error);
      toast.error('Erro ao avançar para próxima música');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomData.room.code);
    toast.success('Código copiado para área de transferência!');
  };

  if (loading && !roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sala...</p>
        </div>
      </div>
    );
  }

  if (!roomData) return null;

  const isAdmin = roomData.room.admin_id === user.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline" 
                size="sm"
                className="border-amber-200 hover:bg-amber-50"
                data-testid="back-to-dashboard-button"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              
              <div className="flex items-center space-x-3">
                <Music className="w-8 h-8 text-amber-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{roomData.room.name}</h1>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Código:</span>
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover:bg-amber-50" 
                      onClick={copyRoomCode}
                      data-testid="room-code-badge"
                    >
                      {roomData.room.code}
                      <Copy className="w-3 h-3 ml-1" />
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Collaborative Recording */}
              <Button 
                onClick={() => setShowCollaborativeRecording(true)}
                variant="outline"
                size="sm"
                className="border-purple-200 hover:bg-purple-50 text-purple-600"
                data-testid="collaborative-recording-button"
              >
                <Users className="w-4 h-4 mr-2" />
                Gravações
              </Button>

              {/* Repertoire History */}
              <Button 
                onClick={() => setShowRepertoireHistory(true)}
                variant="outline"
                size="sm"
                className="border-indigo-200 hover:bg-indigo-50 text-indigo-600"
              >
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>

              {/* Fast Repertoire Generation */}
              <Button 
                onClick={handleGenerateRepertoireFast}
                variant="outline"
                size="sm"
                className="border-green-200 hover:bg-green-50 text-green-600"
                disabled={loading}
              >
                <Zap className="w-4 h-4 mr-2" />
                Repertório Rápido
              </Button>
              
              {/* Presentation Mode */}
              <Button 
                onClick={togglePresentationMode}
                variant={presentationMode ? "default" : "outline"}
                size="sm"
                className={presentationMode ? "bg-purple-600 hover:bg-purple-700" : "border-purple-200 hover:bg-purple-50 text-purple-600"}
                data-testid="presentation-mode-button"
              >
                🎤 {presentationMode ? 'Sair do Show' : 'Modo Show'}
              </Button>
              
              <Button 
                onClick={refreshRoomData}
                variant="outline" 
                size="sm"
                disabled={refreshing}
                className="border-amber-200 hover:bg-amber-50"
                data-testid="refresh-room-button"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              
              {isAdmin && (
                <>
                  <Dialog open={showAddSong} onOpenChange={setShowAddSong}>
                    <DialogTrigger asChild>
                      <Button 
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                        data-testid="add-song-button"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Música
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Nova Música</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddSong} className="space-y-4" data-testid="add-song-form">
                        <div className="space-y-2">
                          <Label htmlFor="song-title">Título da Música</Label>
                          <Input
                            id="song-title"
                            type="text"
                            placeholder="Nome da música"
                            value={songForm.title}
                            onChange={(e) => setSongForm({...songForm, title: e.target.value})}
                            className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                            data-testid="song-title-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="song-artist">Artista</Label>
                          <Input
                            id="song-artist"
                            type="text"
                            placeholder="Nome do artista"
                            value={songForm.artist}
                            onChange={(e) => setSongForm({...songForm, artist: e.target.value})}
                            className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                            data-testid="song-artist-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Button 
                            type="submit" 
                            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                            disabled={loading}
                            data-testid="add-song-submit-button"
                          >
                            {loading ? 'Buscando...' : 'Buscar Online (Spotify + Genius)'}
                          </Button>
                          
                          <Button 
                            type="button"
                            onClick={handleAddSongEnhanced}
                            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                            disabled={loading}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            {loading ? 'Gerando...' : 'Busca Aprimorada (IA + Local)'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    onClick={() => setShowIntelligentSearch(true)}
                    variant="outline"
                    className="border-purple-200 hover:bg-purple-50 text-purple-600"
                    data-testid="intelligent-search-button"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Busca IA
                  </Button>
                  
                  <AudioRecognition 
                    onSongRecognized={async (songData) => {
                      const song = await api.searchSong(songData, token);
                      await handleAddToPlaylist(song);
                    }}
                  />
                  
                  <Dialog open={showPlaylist} onOpenChange={setShowPlaylist}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="border-blue-200 hover:bg-blue-50 text-blue-600"
                        data-testid="playlist-button"
                      >
                        <Music className="w-4 h-4 mr-2" />
                        Playlist ({playlist.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                          <span>Playlist da Sala</span>
                          {isAdmin && (
                            <Button
                              onClick={handleNextSong}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              data-testid="next-song-playlist-button"
                            >
                              <SkipForward className="w-4 h-4 mr-1" />
                              Próxima
                            </Button>
                          )}
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {playlist.length > 0 ? (
                          playlist.map((song, index) => (
                            <Card key={song.id} className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">{song.title}</h4>
                                    <p className="text-gray-600 text-sm">por {song.artist}</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {song.key}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {song.genre}
                                      </Badge>
                                      {roomData?.current_song?.id === song.id && (
                                        <Badge className="bg-green-600 text-white text-xs">
                                          ▶ Tocando
                                        </Badge>
                                      )}
                                      {roomData?.next_song?.id === song.id && (
                                        <Badge className="bg-orange-600 text-white text-xs">
                                          → Próxima
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {isAdmin && (
                                    <>
                                      <Button
                                        onClick={() => handleSetCurrentSong(song.id)}
                                        size="sm"
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        <Play className="w-3 h-3 mr-1" />
                                        Tocar
                                      </Button>
                                      <Button
                                        onClick={() => handleRemoveFromPlaylist(song.id)}
                                        size="sm"
                                        variant="outline"
                                        className="text-xs text-red-600 hover:bg-red-50"
                                      >
                                        ✕
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Music className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500">Nenhuma música na playlist</p>
                            <p className="text-sm text-gray-400 mt-1">
                              Adicione músicas para começar
                            </p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    onClick={loadRecommendations}
                    variant="outline"
                    className="border-amber-200 hover:bg-amber-50"
                    data-testid="ai-recommendations-button"
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Recomendações IA
                  </Button>
                  
                  <Dialog open={showAIRepertoire} onOpenChange={setShowAIRepertoire}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="border-amber-200 hover:bg-amber-50"
                        data-testid="ai-repertoire-button"
                      >
                        <Music className="w-4 h-4 mr-2" />
                        Repertório IA
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Gerar Repertório com IA</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleGenerateAIRepertoire} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Estilo Musical</Label>
                            <Select 
                              value={aiRepertoireForm.style} 
                              onValueChange={(value) => setAiRepertoireForm({...aiRepertoireForm, style: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o estilo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rock">Rock</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="mpb">MPB</SelectItem>
                                <SelectItem value="sertanejo">Sertanejo</SelectItem>
                                <SelectItem value="samba">Samba</SelectItem>
                                <SelectItem value="pagode">Pagode</SelectItem>
                                <SelectItem value="roda-de-samba">Roda de Samba</SelectItem>
                                <SelectItem value="jazz">Jazz</SelectItem>
                                <SelectItem value="blues">Blues</SelectItem>
                                <SelectItem value="reggae">Reggae</SelectItem>
                                <SelectItem value="funk">Funk</SelectItem>
                                <SelectItem value="bossa-nova">Bossa Nova</SelectItem>
                                <SelectItem value="forró">Forró</SelectItem>
                                <SelectItem value="gospel">Gospel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Duração (minutos)</Label>
                            <Input
                              type="number"
                              min="30"
                              max="180"
                              value={aiRepertoireForm.duration_minutes}
                              onChange={(e) => setAiRepertoireForm({...aiRepertoireForm, duration_minutes: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nível de Energia</Label>
                            <Select 
                              value={aiRepertoireForm.energy_level} 
                              onValueChange={(value) => setAiRepertoireForm({...aiRepertoireForm, energy_level: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baixa">Baixa - Acústico/Intimista</SelectItem>
                                <SelectItem value="media">Média - Equilibrado</SelectItem>
                                <SelectItem value="alta">Alta - Energético/Dançante</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Público-Alvo</Label>
                            <Select 
                              value={aiRepertoireForm.audience_type} 
                              onValueChange={(value) => setAiRepertoireForm({...aiRepertoireForm, audience_type: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="familia">Família</SelectItem>
                                <SelectItem value="jovens">Jovens</SelectItem>
                                <SelectItem value="adultos">Adultos</SelectItem>
                                <SelectItem value="idosos">Terceira Idade</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                          disabled={loading}
                        >
                          {loading ? 'Gerando...' : 'Gerar Repertório'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showTranspose} onOpenChange={setShowTranspose}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="border-amber-200 hover:bg-amber-50"
                        data-testid="transpose-button"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Transpor
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transpor Repertório</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleTranspose} className="space-y-4" data-testid="transpose-form">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tom Atual</Label>
                            <Select 
                              value={transposeForm.from_key} 
                              onValueChange={(value) => setTransposeForm({...transposeForm, from_key: value})}
                            >
                              <SelectTrigger data-testid="from-key-select">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {musicalKeys.map((key) => (
                                  <SelectItem key={key} value={key}>{key}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Tom Desejado</Label>
                            <Select 
                              value={transposeForm.to_key} 
                              onValueChange={(value) => setTransposeForm({...transposeForm, to_key: value})}
                            >
                              <SelectTrigger data-testid="to-key-select">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {musicalKeys.map((key) => (
                                  <SelectItem key={key} value={key}>{key}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                          data-testid="transpose-submit-button"
                        >
                          Transpor Repertório
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="border-gray-200 hover:bg-gray-50"
                        data-testid="room-settings-button"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configurações
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Configurações da Sala</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        {/* BPM Control */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center">
                              <Zap className="w-4 h-4 mr-2" />
                              Velocidade (BPM)
                            </Label>
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                              {currentTempo}
                            </span>
                          </div>
                          <Slider
                            value={[currentTempo]}
                            onValueChange={handleTempoSliderChange}
                            max={200}
                            min={60}
                            step={1}
                            className="w-full"
                            disabled={!isAdmin}
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>60 (Lento)</span>
                            <span>200 (Rápido)</span>
                          </div>
                          {!isAdmin && (
                            <p className="text-xs text-amber-600">Apenas o admin pode alterar o BPM</p>
                          )}
                        </div>
                        
                        {/* Font Size Control */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center">
                              <Type className="w-4 h-4 mr-2" />
                              Tamanho da Fonte
                            </Label>
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                              {fontSize}px
                            </span>
                          </div>
                          <Slider
                            value={[fontSize]}
                            onValueChange={handleFontSizeChange}
                            max={24}
                            min={12}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>12px (Pequeno)</span>
                            <span>24px (Grande)</span>
                          </div>
                        </div>
                        
                        {/* Quick Transpose */}
                        {isAdmin && roomData?.current_song && (
                          <div className="space-y-3">
                            <Label className="flex items-center">
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Transposição Rápida
                            </Label>
                            <div className="grid grid-cols-6 gap-2">
                              {musicalKeys.map(key => (
                                <Button
                                  key={key}
                                  variant={roomData.current_song.key === key ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleKeyChange(key)}
                                  className="text-xs"
                                >
                                  {key}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Current Song */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Song */}
            {roomData.current_song ? (
              <Card className="bg-white/90 backdrop-blur-sm border-amber-200/50 shadow-lg" data-testid="current-song-card">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl text-gray-900 flex items-center">
                        <Play className="w-6 h-6 mr-2 text-green-600" />
                        Tocando Agora
                      </CardTitle>
                      <h2 className="text-3xl font-bold text-amber-600 mt-1">
                        {roomData.current_song.title}
                      </h2>
                      <p className="text-xl text-gray-600">por {roomData.current_song.artist}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Badge variant="outline">Tom: {roomData.current_song.key}</Badge>
                          <Badge variant="outline">{roomData.current_song.genre}</Badge>
                          {roomData.current_song.tempo && (
                            <Badge variant="outline">{roomData.current_song.tempo} BPM</Badge>
                          )}
                          {roomData.current_song.album && (
                            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                              📀 {roomData.current_song.album}
                            </Badge>
                          )}
                          {roomData.current_song.release_date && (
                            <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-700">
                              {roomData.current_song.release_date.substring(0, 4)}
                            </Badge>
                          )}
                          {roomData.current_song.popularity && roomData.current_song.popularity > 0 && (
                            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                              🔥 {roomData.current_song.popularity}%
                            </Badge>
                          )}
                        </div>
                        
                        {isAdmin && (
                          <Button
                            onClick={() => {
                              setTransposeForm({ from_key: roomData.current_song.key, to_key: '' });
                              setShowTranspose(true);
                            }}
                            size="sm"
                            variant="outline"
                            className="border-amber-200 hover:bg-amber-50"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Mudar Tom
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="lyrics" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-amber-50">
                      <TabsTrigger 
                        value="lyrics"
                        className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                      >
                        Letra
                      </TabsTrigger>
                      <TabsTrigger 
                        value="chords"
                        className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                      >
                        Acordes
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="lyrics" className="mt-4">
                      <SimpleLyricsDisplay
                        lyrics={roomData.current_song.lyrics}
                        chords={roomData.current_song.chords}
                        bpm={currentSongTempo || roomData.current_song.bpm || 120}
                        fontSize={fontSize}
                        onTempoChange={handleTempoChange}
                        roomId={roomId}
                      />
                      
                      {/* Song Info */}
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge 
                              variant="outline" 
                              className="bg-blue-50 border-blue-200 text-blue-700 flex items-center"
                            >
                              <Gauge className="w-3 h-3 mr-1" />
                              {currentSongTempo || roomData.current_song.bpm || 120} BPM
                            </Badge>
                            
                            {roomData.current_song.source && (
                              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                                {roomData.current_song.source === 'ai_generated' ? '🤖 IA' : 
                                 roomData.current_song.source === 'local_database' ? '📚 Local' : 
                                 '🌐 Online'}
                              </Badge>
                            )}
                          </div>
                          
                          {roomData.current_song.preview_url && (
                            <audio 
                              controls 
                              preload="metadata"
                              className="h-8"
                            >
                              <source src={roomData.current_song.preview_url} type="audio/mpeg" />
                              Seu navegador não suporta áudio.
                            </audio>
                          )}
                        </div>
                        
                        {roomData.current_song.genre && (
                          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                            🎼 {roomData.current_song.genre}
                          </Badge>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="chords" className="mt-4">
                      <div className="chord-display bg-gray-50 p-6 rounded-lg max-h-96 overflow-y-auto">
                        <pre 
                          className="whitespace-pre-wrap font-mono text-gray-800 leading-relaxed"
                          style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                        >
                          {roomData.current_song.chords}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    {/* Instrument-specific notation tab removed - collaborative system doesn't need individual instruments */}
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/90 backdrop-blur-sm border-amber-200/50 shadow-lg">
                <CardContent className="py-16 text-center">
                  <Music className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">Nenhuma música selecionada</h3>
                  <p className="text-gray-500">
                    {isAdmin ? 'Adicione uma música para começar' : 'Aguarde o admin selecionar uma música'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Spacer for fixed next song bar */}
            <div className="h-20"></div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Members */}
            <Card className="bg-white/90 backdrop-blur-sm border-amber-200/50 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-gray-600" />
                  Integrantes ({roomData.members.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roomData.members.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`member-${member.user_name}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {member.user_name}
                          {member.user_id === roomData.room.admin_id && (
                            <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">Participante</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced AI Recommendations Dialog */}
            <RecommendationsDialog
              isOpen={showRecommendations}
              onClose={() => setShowRecommendations(false)}
              recommendations={recommendations}
              onAddToPlaylist={handleAddRecommendationsToPlaylist}
              loading={loading}
            />
          </div>
        </div>
        
        {/* Intelligent Search Component */}
        <IntelligentSearch
          isOpen={showIntelligentSearch}
          onClose={() => setShowIntelligentSearch(false)}
          onSongSelect={async (song) => {
            await loadRoomData();
            toast.success('Música adicionada ao repertório!');
          }}
        />
        
        {/* Collaborative Recording Component */}
        <CollaborativeRecording
          roomId={roomId}
          isOpen={showCollaborativeRecording}
          onClose={() => setShowCollaborativeRecording(false)}
        />

        {/* Repertoire History Component */}
        <RepertoireHistory
          roomId={roomId}
          currentPlaylist={playlist}
          isOpen={showRepertoireHistory}
          onClose={() => setShowRepertoireHistory(false)}
        />

        {/* Fixed Next Song Bar */}
        <NextSongBar
          nextSong={roomData?.next_song}
          isAdmin={isAdmin}
          onPlayNext={() => roomData?.next_song && handleSetCurrentSong(roomData.next_song.id)}
          onAdvancePlaylist={handleNextSong}
        />
      </div>
    </div>
  );
};

export default Room;