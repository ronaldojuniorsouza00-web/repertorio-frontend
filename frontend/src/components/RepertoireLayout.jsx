import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Music, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  SkipForward,
  ArrowRight,
  Zap,
  Play,
  Pause,
  Timer
} from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';

const RepertoireLayout = ({ 
  roomId, 
  currentSong, 
  playlist = [], 
  onSongChange,
  onNextSong,
  fontSize = 16
}) => {
  const { user, token } = useAuth();
  const [transitionChords, setTransitionChords] = useState([]);
  const [showTransitions, setShowTransitions] = useState(true);
  const [loadingTransitions, setLoadingTransitions] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerRef = React.useRef(null);

  useEffect(() => {
    if (playlist.length > 1) {
      loadTransitionChords();
    }
  }, [playlist, roomId]);

  const loadTransitionChords = async () => {
    try {
      setLoadingTransitions(true);
      const response = await api.getTransitionChords(roomId, token);
      setTransitionChords(response.transitions || []);
    } catch (error) {
      console.error('Error loading transition chords:', error);
    } finally {
      setLoadingTransitions(false);
    }
  };

  const handleNextSong = async () => {
    try {
      await onNextSong();
      toast.success('Próxima música!');
    } catch (error) {
      console.error('Error going to next song:', error);
      toast.error('Erro ao avançar música');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSongIndex = () => {
    if (!currentSong || !playlist.length) return -1;
    return playlist.findIndex(song => song.id === currentSong.id);
  };

  const getNextSongs = () => {
    const currentIndex = getCurrentSongIndex();
    if (currentIndex === -1) return playlist.slice(0, 3);
    return playlist.slice(currentIndex + 1, currentIndex + 4);
  };

  const getTransitionForPosition = (position) => {
    return transitionChords.find(t => t.position === position);
  };

  const currentIndex = getCurrentSongIndex();
  const nextSongs = getNextSongs();

  return (
    <div className="repertoire-layout space-y-6">
      {/* Música Atual - Destaque Principal */}
      {currentSong ? (
        <Card className="current-song-card border-2 border-blue-500 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-blue-900">TOCANDO AGORA</CardTitle>
                  <p className="text-blue-600">Música atual da apresentação</p>
                </div>
              </div>
              {nextSongs.length > 0 && (
                <Button
                  onClick={handleNextSong}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                  size="lg"
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  Próxima Música
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* Info da Música Atual */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentSong.title}</h2>
                <p className="text-xl text-gray-700 mb-4">{currentSong.artist}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-800 text-sm px-3 py-1">
                    🎵 Tom: {currentSong.key || 'C'}
                  </Badge>
                  <Badge variant="outline" className="bg-purple-100 border-purple-300 text-purple-800 text-sm px-3 py-1">
                    ⏱️ {currentSong.bpm || 120} BPM
                  </Badge>
                  {currentSong.genre && (
                    <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800 text-sm px-3 py-1">
                      🎼 {currentSong.genre}
                    </Badge>
                  )}
                  {currentSong.duration && (
                    <Badge variant="outline" className="bg-orange-100 border-orange-300 text-orange-800 text-sm px-3 py-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(currentSong.duration)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Acordes da Música Atual */}
              {currentSong.chords && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                    🎸 Acordes Principais:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentSong.chords.split(/[\s\-,]+/).filter(chord => chord.trim()).map((chord, index) => (
                      <Badge
                        key={index}
                        className="bg-blue-600 text-white text-lg px-3 py-2 font-bold"
                      >
                        {chord.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-gray-300 bg-gray-50">
          <CardContent className="text-center py-12">
            <Music className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Nenhuma música selecionada</h3>
            <p className="text-gray-500">Adicione músicas ao repertório e selecione uma para começar</p>
          </CardContent>
        </Card>
      )}

      {/* Próximas Músicas + Acordes de Transição */}
      {nextSongs.length > 0 && (
        <Card className="next-songs-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-gray-900 flex items-center">
                <SkipForward className="w-5 h-5 mr-2 text-green-600" />
                Próximas Músicas ({nextSongs.length})
              </CardTitle>
              <Button
                onClick={() => setShowTransitions(!showTransitions)}
                variant="outline"
                size="sm"
                className="border-gray-300"
              >
                {showTransitions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showTransitions ? 'Ocultar' : 'Mostrar'} Transições
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {nextSongs.map((song, index) => {
                const actualPosition = currentIndex + index;
                const transition = getTransitionForPosition(actualPosition);
                
                return (
                  <div key={song.id} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-lg">{song.title}</h4>
                        <p className="text-gray-600">{song.artist}</p>
                        
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Tom: {song.key || 'C'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {song.bpm || 120} BPM
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800 text-sm">
                          #{actualPosition + 2}
                        </Badge>
                        <Button
                          onClick={() => onSongChange(song)}
                          variant="outline"
                          size="sm"
                          className="border-blue-200 hover:bg-blue-50 text-blue-600"
                        >
                          Tocar Agora
                        </Button>
                      </div>
                    </div>

                    {/* Acordes de Transição */}
                    {showTransitions && transition && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <Zap className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-semibold text-amber-800">
                            Transição: {transition.from_song} → {transition.to_song}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Acordes de passagem:</span>
                          {transition.transition_chords.map((chord, chordIndex) => (
                            <React.Fragment key={chordIndex}>
                              <Badge className="bg-amber-600 text-white text-sm font-bold">
                                {chord}
                              </Badge>
                              {chordIndex < transition.transition_chords.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-amber-600" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        
                        <p className="text-xs text-amber-700 mt-2">
                          💡 Use estes acordes para conectar suavemente as músicas
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {loadingTransitions && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Calculando acordes de transição...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repertório Vazio */}
      {playlist.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="text-center py-12">
            <Music className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Repertório Vazio</h3>
            <p className="text-gray-500 mb-4">
              Adicione músicas ao repertório para começar sua apresentação
            </p>
            <div className="flex justify-center space-x-4">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Adicionar Música
              </Button>
              <Button variant="outline">
                Gerar Repertório por IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RepertoireLayout;