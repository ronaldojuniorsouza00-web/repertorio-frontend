import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Volume2, 
  Trash2, 
  Users,
  Clock,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';
import socketService from '../services/socket';

const CollaborativeRecording = ({ roomId, isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingRecordings, setPlayingRecordings] = useState(new Set());
  const [volumes, setVolumes] = useState({});
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const currentRecordingIdRef = useRef(null);
  const audioElementsRef = useRef({});

  useEffect(() => {
    if (isOpen) {
      loadRecordings();
      setupSocketListeners();
    }
    
    return () => {
      cleanupSocketListeners();
    };
  }, [isOpen, roomId]);

  const setupSocketListeners = () => {
    socketService.onRecordingStarted((data) => {
      toast.info(`${data.user_name} iniciou uma gravação: "${data.recording_name}"`);
      loadRecordings();
    });

    socketService.onRecordingStopped((data) => {
      toast.success(`${data.user_name} finalizou a gravação`);
      loadRecordings();
    });

    socketService.onRecordingPlay((data) => {
      setPlayingRecordings(prev => new Set([...prev, data.recording_id]));
      playRecordingAudio(data.recording_id);
      if (data.triggered_by !== user.name) {
        toast.info(`${data.triggered_by} iniciou reprodução de uma gravação`);
      }
    });

    socketService.onRecordingPause((data) => {
      setPlayingRecordings(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.recording_id);
        return newSet;
      });
      pauseRecordingAudio(data.recording_id);
      if (data.triggered_by !== user.name) {
        toast.info(`${data.triggered_by} pausou uma gravação`);
      }
    });

    socketService.onRecordingVolumeChanged((data) => {
      setVolumes(prev => ({ ...prev, [data.recording_id]: data.volume }));
      updateRecordingVolume(data.recording_id, data.volume);
    });

    socketService.onRecordingDeleted((data) => {
      toast.info(`Gravação removida por ${data.deleted_by}`);
      loadRecordings();
      setPlayingRecordings(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.recording_id);
        return newSet;
      });
    });
  };

  const cleanupSocketListeners = () => {
    socketService.removeListener('recording_started');
    socketService.removeListener('recording_stopped');
    socketService.removeListener('recording_play');
    socketService.removeListener('recording_pause');
    socketService.removeListener('recording_volume_changed');
    socketService.removeListener('recording_deleted');
  };

  const loadRecordings = async () => {
    try {
      const response = await api.getRecordings(roomId, token);
      setRecordings(response.recordings);
      
      // Initialize volumes for new recordings
      const newVolumes = {};
      response.recordings.forEach(recording => {
        if (!(recording.id in volumes)) {
          newVolumes[recording.id] = recording.volume || 1.0;
        }
      });
      if (Object.keys(newVolumes).length > 0) {
        setVolumes(prev => ({ ...prev, ...newVolumes }));
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
      toast.error('Erro ao carregar gravações');
    }
  };

  const startRecording = async () => {
    if (!recordingName.trim()) {
      toast.error('Por favor, digite um nome para a gravação');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await finalizeRecording(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording on backend
      const response = await api.startRecording(roomId, { recording_name: recordingName }, token);
      currentRecordingIdRef.current = response.recording_id;
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setShowNameDialog(false);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success('Gravação iniciada!');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      toast.info('Finalizando gravação...');
    }
  };

  const finalizeRecording = async (audioBlob) => {
    try {
      await api.stopRecording(roomId, currentRecordingIdRef.current, recordingTime, token);
      
      // Here you would typically upload the audio blob to a storage service
      // For now, we'll just simulate it
      console.log('Audio blob size:', audioBlob.size);
      
      toast.success('Gravação finalizada com sucesso!');
      setRecordingName('');
      setRecordingTime(0);
      currentRecordingIdRef.current = null;
      
      await loadRecordings();
    } catch (error) {
      console.error('Error finalizing recording:', error);
      toast.error('Erro ao finalizar gravação');
    }
  };

  const playRecordingAudio = (recordingId) => {
    // Simular reprodução de áudio para demonstração
    const audioElement = audioElementsRef.current[recordingId];
    if (audioElement) {
      // Create a simple tone to simulate playback
      audioElement.play().catch(e => console.log('Audio play error:', e));
    } else {
      // Criar áudio de demonstração
      createDemoAudio(recordingId);
    }
    console.log('Playing recording:', recordingId);
  };

  const pauseRecordingAudio = (recordingId) => {
    const audioElement = audioElementsRef.current[recordingId];
    if (audioElement) {
      audioElement.pause();
    }
    console.log('Pausing recording:', recordingId);
  };

  const updateRecordingVolume = (recordingId, volume) => {
    const audioElement = audioElementsRef.current[recordingId];
    if (audioElement) {
      audioElement.volume = volume;
    }
  };

  const createDemoAudio = (recordingId) => {
    // Criar um áudio de demonstração simples
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      
      // Parar após 2 segundos
      setTimeout(() => {
        oscillator.stop();
        setPlayingRecordings(prev => {
          const newSet = new Set(prev);
          newSet.delete(recordingId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.log('Demo audio error:', error);
    }
  };

  const togglePlayback = async (recording) => {
    const isPlaying = playingRecordings.has(recording.id);
    
    try {
      if (isPlaying) {
        await api.pauseRecording(roomId, recording.id, token);
      } else {
        await api.playRecording(roomId, recording.id, token);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      toast.error('Erro ao controlar reprodução');
    }
  };

  const handleVolumeChange = async (recordingId, newVolume) => {
    const volume = newVolume[0];
    try {
      await api.setRecordingVolume(roomId, recordingId, volume, token);
    } catch (error) {
      console.error('Error setting volume:', error);
      toast.error('Erro ao ajustar volume');
    }
  };

  const deleteRecording = async (recordingId) => {
    if (!confirm('Tem certeza que deseja excluir esta gravação?')) {
      return;
    }
    
    try {
      await api.deleteRecording(roomId, recordingId, token);
      toast.success('Gravação excluída');
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Erro ao excluir gravação');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Users className="w-6 h-6 mr-2 text-purple-600" />
            Gravações Colaborativas
          </DialogTitle>
          <p className="text-gray-600">
            Grave, ouça e colabore com outros músicos em tempo real
          </p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Recording Controls */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Mic className="w-5 h-5 mr-2 text-purple-600" />
              Nova Gravação
            </h3>
            
            {!isRecording ? (
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => setShowNameDialog(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Iniciar Gravação
                </Button>
                <p className="text-sm text-gray-600">
                  Clique para nomear e iniciar uma nova gravação
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="font-semibold text-red-600">Gravando...</span>
                  <span className="font-mono text-lg">{formatDuration(recordingTime)}</span>
                  <Badge variant="outline" className="border-red-200 text-red-600">
                    {recordingName}
                  </Badge>
                </div>
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              </div>
            )}
          </div>

          {/* Recordings List */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Volume2 className="w-5 h-5 mr-2 text-blue-600" />
              Gravações da Sala ({recordings.length})
            </h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recordings.length > 0 ? (
                recordings.map((recording) => (
                  <div key={recording.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{recording.recording_name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {recording.user_name}
                          </Badge>
                          {recording.duration && (
                            <Badge variant="outline" className="text-xs flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDuration(recording.duration)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Criada em {formatDate(recording.created_at)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Play/Pause Button - Mais Destaque */}
                        <Button
                          onClick={() => togglePlayback(recording)}
                          size="lg"
                          variant={playingRecordings.has(recording.id) ? "default" : "outline"}
                          className={playingRecordings.has(recording.id) ? 
                            "bg-green-600 hover:bg-green-700 text-white shadow-lg" : 
                            "border-green-300 hover:bg-green-50 text-green-700 shadow-md"
                          }
                        >
                          {playingRecordings.has(recording.id) ? (
                            <>
                              <Pause className="w-5 h-5 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5 mr-2" />
                              Reproduzir
                            </>
                          )}
                        </Button>
                        
                        {/* Download Button */}
                        <Button
                          onClick={() => console.log('Download recording:', recording.id)}
                          size="sm"
                          variant="outline"
                          className="border-blue-200 hover:bg-blue-50 text-blue-600"
                          title="Baixar gravação"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        {/* Delete Button (only for own recordings) */}
                        {recording.user_id === user.id && (
                          <Button
                            onClick={() => deleteRecording(recording.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-200 hover:bg-red-50 text-red-600"
                            title="Excluir gravação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Volume Control */}
                    <div className="mt-3 flex items-center space-x-3">
                      <Volume2 className="w-4 h-4 text-gray-400" />
                      <Slider
                        value={[volumes[recording.id] || 1.0]}
                        onValueChange={(value) => handleVolumeChange(recording.id, value)}
                        max={1}
                        min={0}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500 w-8">
                        {Math.round((volumes[recording.id] || 1.0) * 100)}%
                      </span>
                    </div>
                    
                    {/* Audio element com controles visíveis para debug */}
                    <div className="mt-3 p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-2">Player de Áudio:</p>
                      <audio
                        ref={el => {
                          if (el) audioElementsRef.current[recording.id] = el;
                        }}
                        controls
                        preload="metadata"
                        className="w-full h-8"
                        onEnded={() => {
                          setPlayingRecordings(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(recording.id);
                            return newSet;
                          });
                        }}
                      >
                        {/* Usar arquivo de áudio de demonstração */}
                        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL0/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBDuL" type="audio/wav" />
                        Seu navegador não suporta áudio.
                      </audio>
                      <p className="text-xs text-gray-400 mt-1">
                        Nota: Sistema de gravação em desenvolvimento. Audio de demonstração.
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Mic className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Nenhuma gravação ainda</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Seja o primeiro a gravar nesta sala!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Recording Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nome da Gravação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recording-name">Como você quer chamar esta gravação?</Label>
              <Input
                id="recording-name"
                type="text"
                placeholder="Ex: Guitarra - Solo principal"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={startRecording}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={!recordingName.trim()}
              >
                Iniciar Gravação
              </Button>
              <Button
                onClick={() => setShowNameDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default CollaborativeRecording;