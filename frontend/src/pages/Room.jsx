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
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';
import socketService from '../services/socket';

const Room = () => {
  const { roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showTranspose, setShowTranspose] = useState(false);
  const [showAIRepertoire, setShowAIRepertoire] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [currentUserInstrument, setCurrentUserInstrument] = useState('');
  const [instrumentNotation, setInstrumentNotation] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
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
    
    return () => {
      // Leave room and cleanup
      if (user && roomId) {
        socketService.leaveRoom(roomId, user.id);
      }
      socketService.removeListener('user_joined', handleUserJoined);
      socketService.removeListener('user_left', handleUserLeft);
      socketService.removeListener('song_changed', handleSongChanged);
      socketService.removeListener('transpose_changed', handleTransposeChanged);
    };
  }, [roomId, user]);

  useEffect(() => {
    if (roomData?.current_song && currentUserInstrument) {
      loadInstrumentNotation();
    }
  }, [roomData?.current_song, currentUserInstrument]);

  const loadRoomData = async () => {
    try {
      const data = await api.getRoom(roomId, token);
      setRoomData(data);
      
      // Find current user's instrument
      const userMember = data.members.find(m => m.user_id === user.id);
      if (userMember) {
        setCurrentUserInstrument(userMember.instrument);
      }
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

  const loadInstrumentNotation = async () => {
    if (!roomData?.current_song || !currentUserInstrument) return;
    
    try {
      const notation = await api.getInstrumentNotation(
        roomData.current_song.id, 
        currentUserInstrument, 
        token
      );
      setInstrumentNotation(notation.notation);
    } catch (error) {
      console.error('Error loading notation:', error);
      setInstrumentNotation('Notação não disponível no momento');
    }
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!songForm.title.trim() || !songForm.artist.trim()) {
      toast.error('Por favor, preencha título e artista');
      return;
    }
    
    setLoading(true);
    try {
      const song = await api.searchSong(songForm, token);
      toast.success(`Música "${song.title}" adicionada!`);
      setSongForm({ title: '', artist: '' });
      setShowAddSong(false);
      await loadRoomData();
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error('Erro ao adicionar música');
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
                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                          disabled={loading}
                          data-testid="add-song-submit-button"
                        >
                          {loading ? 'Adicionando...' : 'Adicionar Música'}
                        </Button>
                      </form>
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
                      <div className="flex items-center space-x-4 mt-2">
                        <Badge variant="outline">Tom: {roomData.current_song.key}</Badge>
                        <Badge variant="outline">{roomData.current_song.genre}</Badge>
                        {roomData.current_song.tempo && (
                          <Badge variant="outline">{roomData.current_song.tempo} BPM</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="lyrics" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4 bg-amber-50">
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
                        Acordes Gerais
                      </TabsTrigger>
                      <TabsTrigger 
                        value="instrument"
                        className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                      >
                        Meu {currentUserInstrument}
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="lyrics" className="mt-4">
                      <div className="lyrics-display bg-gray-50 p-6 rounded-lg max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                          {roomData.current_song.lyrics}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="chords" className="mt-4">
                      <div className="chord-display bg-gray-50 p-6 rounded-lg max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-mono text-gray-800 leading-relaxed">
                          {roomData.current_song.chords}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="instrument" className="mt-4">
                      <div className="notation-display max-h-96 overflow-y-auto" data-testid="instrument-notation">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Music className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-800">
                              Notação específica para {currentUserInstrument}
                            </span>
                          </div>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-gray-800 leading-relaxed">
                          {instrumentNotation || 'Carregando notação...'}
                        </pre>
                      </div>
                    </TabsContent>
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

            {/* Next Song Preview */}
            {roomData.next_song && (
              <Card className="bg-gradient-to-r from-orange-100 to-red-100 border-orange-200 shadow-lg" data-testid="next-song-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <SkipForward className="w-5 h-5 mr-2 text-orange-600" />
                    Próxima: {roomData.next_song.title} - {roomData.next_song.artist}
                  </CardTitle>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="border-orange-300 text-orange-700">
                      Tom: {roomData.next_song.key}
                    </Badge>
                    <Badge variant="outline" className="border-orange-300 text-orange-700">
                      {roomData.next_song.genre}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            )}
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
                        <p className="text-sm text-gray-600">{member.instrument}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Dialog open={showRecommendations} onOpenChange={setShowRecommendations}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Lightbulb className="w-5 h-5 mr-2 text-yellow-600" />
                    Recomendações IA
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recommendations.length > 0 ? (
                    recommendations.map((recommendation, index) => (
                      <div 
                        key={index} 
                        className="p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
                        <p className="text-sm font-medium text-gray-900">{recommendation}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      Nenhuma recomendação disponível. Toque uma música primeiro!
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;