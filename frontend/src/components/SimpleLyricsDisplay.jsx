import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Rewind,
  Settings2,
  Gauge,
  Music2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

const SimpleLyricsDisplay = ({ 
  lyrics, 
  chords = "", 
  bpm = 120, 
  fontSize = 16, 
  onTempoChange,
  roomId 
}) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); // segundos por tela
  const [currentTempo, setCurrentTempo] = useState(bpm);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const lyricsRef = useRef(null);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    setCurrentTempo(bpm);
  }, [bpm]);

  useEffect(() => {
    if (isScrolling) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
    
    return () => stopAutoScroll();
  }, [isScrolling, scrollSpeed, currentTempo]);

  const startAutoScroll = () => {
    if (!lyricsRef.current) return;
    
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      if (!lyricsRef.current) return;
      
      const container = lyricsRef.current;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      
      if (scrollHeight <= 0) return;
      
      // Calcular velocidade baseada no BPM e configuração do usuário
      const beatsPerSecond = currentTempo / 60;
      const scrollPerSecond = scrollHeight / scrollSpeed;
      
      // Ajustar pela velocidade da música
      const adjustedScrollSpeed = scrollPerSecond * (beatsPerSecond / 2);
      
      setScrollPosition(prev => {
        const newPosition = prev + adjustedScrollSpeed;
        
        if (newPosition >= scrollHeight) {
          // Chegou ao fim, parar scroll
          setIsScrolling(false);
          return scrollHeight;
        }
        
        container.scrollTop = newPosition;
        return newPosition;
      });
      
    }, 100); // Atualizar a cada 100ms para suavidade
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetScroll = () => {
    setIsScrolling(false);
    setScrollPosition(0);
    if (lyricsRef.current) {
      lyricsRef.current.scrollTop = 0;
    }
  };

  const handleTempoChange = (change) => {
    const newTempo = Math.max(60, Math.min(200, currentTempo + change));
    setCurrentTempo(newTempo);
    
    if (onTempoChange) {
      onTempoChange(change);
    }
  };

  const handleSpeedChange = (newSpeed) => {
    setScrollSpeed(newSpeed[0]);
  };

  const toggleScroll = () => {
    setIsScrolling(!isScrolling);
  };

  // Extrair cifras das letras (remover [acordes] das letras)
  const extractChordsFromLyrics = (lyricsText) => {
    if (!lyricsText) return { cleanLyrics: "", chordsList: [] };
    
    const chordPattern = /\[([^\]]+)\]/g;
    const chordsFound = [];
    let match;
    
    while ((match = chordPattern.exec(lyricsText)) !== null) {
      if (!chordsFound.includes(match[1])) {
        chordsFound.push(match[1]);
      }
    }
    
    // Remover acordes das letras
    const cleanLyrics = lyricsText.replace(chordPattern, '');
    
    return {
      cleanLyrics: cleanLyrics.trim(),
      chordsList: chordsFound
    };
  };

  const { cleanLyrics, chordsList } = extractChordsFromLyrics(lyrics);
  const finalChords = chordsList.length > 0 ? chordsList.join(' - ') : chords;

  const formatLyrics = (lyricsText) => {
    if (!lyricsText) return "Letra não disponível";
    
    return lyricsText
      .split('\n')
      .map((line, index) => (
        <div 
          key={index} 
          className={`lyrics-line mb-2 ${line.trim() === '' ? 'mb-4' : ''}`}
          style={{ 
            fontSize: `${fontSize}px`,
            lineHeight: '1.6',
            minHeight: line.trim() === '' ? '20px' : 'auto'
          }}
        >
          {line.trim() || '\u00A0'}
        </div>
      ));
  };

  return (
    <div className="lyrics-display-container">
      {/* Controles de Auto-Scroll */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleScroll}
            size="sm"
            variant={isScrolling ? "default" : "outline"}
            className={isScrolling ? 
              "bg-green-600 hover:bg-green-700 text-white" : 
              "border-green-200 hover:bg-green-50 text-green-600"
            }
          >
            {isScrolling ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {isScrolling ? 'Pausar' : 'Auto-Scroll'}
          </Button>
          
          <Button
            onClick={resetScroll}
            size="sm"
            variant="outline"
            className="border-blue-200 hover:bg-blue-50 text-blue-600"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reiniciar
          </Button>
        </div>

        {/* Controles de Velocidade */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => handleTempoChange(-10)}
            size="sm"
            variant="outline"
            className="border-orange-200 hover:bg-orange-50 text-orange-600"
          >
            <Rewind className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center space-x-1 text-sm font-medium">
            <Gauge className="w-4 h-4 text-purple-600" />
            <span className="text-purple-600">{currentTempo} BPM</span>
          </div>
          
          <Button
            onClick={() => handleTempoChange(+10)}
            size="sm"
            variant="outline"
            className="border-orange-200 hover:bg-orange-50 text-orange-600"
          >
            <FastForward className="w-4 h-4" />
          </Button>

          {/* Configurações */}
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-gray-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurações do Auto-Scroll</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Velocidade do Scroll (segundos por tela)</Label>
                  <Slider
                    value={[scrollSpeed]}
                    onValueChange={handleSpeedChange}
                    min={10}
                    max={60}
                    step={5}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Rápido (10s)</span>
                    <span>{scrollSpeed}s</span>
                    <span>Lento (60s)</span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Container Principal com Cifras Fixas e Letras */}
      <div className="flex gap-4">
        {/* Cifras Fixas na Lateral */}
        {finalChords && (
          <div className="w-64 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center mb-3">
              <Music2 className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-blue-900">Cifras da Música</h3>
            </div>
            
            <div className="space-y-2">
              {finalChords.split(' - ').map((chord, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="mr-2 mb-2 bg-white border-blue-300 text-blue-700 text-sm font-bold px-3 py-1"
                >
                  {chord.trim()}
                </Badge>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Tom atual:</strong> {currentTempo} BPM
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Cifras sempre visíveis durante a música
              </p>
            </div>
          </div>
        )}

        {/* Container das Letras */}
        <div className="flex-1">
          <div 
            ref={lyricsRef}
            className="lyrics-display max-h-96 overflow-y-auto bg-white rounded-lg border p-6 shadow-sm"
            style={{ 
              scrollBehavior: isScrolling ? 'auto' : 'smooth',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
            }}
          >
            <div className="font-mono text-gray-800 leading-relaxed">
              {formatLyrics(cleanLyrics || lyrics)}
            </div>
          </div>

          {/* Indicador de Progresso */}
          {isScrolling && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ 
                    width: `${Math.min(100, (scrollPosition / (lyricsRef.current?.scrollHeight - lyricsRef.current?.clientHeight || 1)) * 100)}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Progresso do Auto-Scroll</span>
                <span>{Math.round((scrollPosition / (lyricsRef.current?.scrollHeight - lyricsRef.current?.clientHeight || 1)) * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleLyricsDisplay;