import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Mic, Square, Loader2, Music, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';

const AudioRecognition = ({ onSongRecognized }) => {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedSong, setRecognizedSong] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  const startRecording = async () => {
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
        await recognizeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, 30000);
      
      toast.success('Gravação iniciada! Toque a música...');
      
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
      
      setIsProcessing(true);
      toast.info('Processando áudio...');
    }
  };

  const recognizeAudio = async (audioBlob) => {
    try {
      const result = await api.recognizeAudio(audioBlob, token);
      
      if (result.recognized) {
        setRecognizedSong(result.song);
        toast.success(`Música reconhecida: ${result.song.title}`);
      } else {
        toast.error('Música não reconhecida. Tente novamente com melhor qualidade de áudio.');
        setRecognizedSong(null);
      }
    } catch (error) {
      console.error('Error recognizing audio:', error);
      toast.error('Erro no reconhecimento de áudio');
      setRecognizedSong(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddRecognizedSong = async () => {
    if (recognizedSong && onSongRecognized) {
      try {
        await onSongRecognized({
          title: recognizedSong.title,
          artist: recognizedSong.artist
        });
        
        setIsOpen(false);
        setRecognizedSong(null);
        setRecordingTime(0);
        toast.success('Música adicionada à playlist!');
      } catch (error) {
        console.error('Error adding recognized song:', error);
        toast.error('Erro ao adicionar música');
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="border-red-200 hover:bg-red-50 text-red-600"
          data-testid="audio-recognition-button"
        >
          <Mic className="w-4 h-4 mr-2" />
          Reconhecer Áudio
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Volume2 className="w-5 h-5 mr-2 text-red-600" />
            Reconhecimento de Áudio
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Recording Controls */}
          <div className="text-center space-y-4">
            {!isRecording && !isProcessing && !recognizedSong && (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-600 text-sm">
                  Toque uma música próximo ao microfone e clique em gravar
                </p>
                <Button
                  onClick={startRecording}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="start-recording-button"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Iniciar Gravação
                </Button>
              </div>
            )}
            
            {isRecording && (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-red-600 font-semibold">🎙️ Gravando...</p>
                  <div className="text-2xl font-mono text-gray-700">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${(recordingTime / 30) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="stop-recording-button"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Parar e Reconhecer
                </Button>
              </div>
            )}
            
            {isProcessing && (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <p className="text-blue-600 font-semibold">
                  🎵 Identificando música...
                </p>
                <p className="text-sm text-gray-500">
                  Analisando áudio com IA
                </p>
              </div>
            )}
            
            {recognizedSong && (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <Music className="w-8 h-8 text-white" />
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-bold text-green-800 text-lg">
                    ✅ Música Reconhecida!
                  </h3>
                  <p className="text-green-700 font-semibold mt-2">
                    {recognizedSong.title}
                  </p>
                  <p className="text-green-600">
                    por {recognizedSong.artist}
                  </p>
                  
                  {recognizedSong.album && (
                    <div className="mt-2">
                      <Badge variant="outline" className="border-green-300 text-green-700">
                        {recognizedSong.album}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={handleAddRecognizedSong}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    data-testid="add-recognized-song-button"
                  >
                    Adicionar à Playlist
                  </Button>
                  <Button
                    onClick={() => {
                      setRecognizedSong(null);
                      setRecordingTime(0);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">💡 Dicas:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Volume da música bem audível</li>
              <li>• Evite ruído de fundo</li>
              <li>• Grave pelo menos 10-15 segundos</li>
              <li>• Funciona melhor com músicas conhecidas</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AudioRecognition;