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
  Gauge
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';

const LyricsAutoScroll = ({ 
  lyrics, 
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

  const parseLineWithChords = (line) => {
    if (!line.trim()) return { chords: [], lyrics: '' };
    
    const parts = [];
    const chordPattern = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;
    
    while ((match = chordPattern.exec(line)) !== null) {
      // Adicionar texto antes do acorde
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: line.substring(lastIndex, match.index)
        });
      }
      
      // Adicionar o acorde
      parts.push({
        type: 'chord',
        content: match[1]
      });
      
      lastIndex = chordPattern.lastIndex;
    }
    
    // Adicionar texto restante
    if (lastIndex < line.length) {
      parts.push({
        type: 'text',
        content: line.substring(lastIndex)
      });
    }
    
    return parts;
  };

  const formatLyrics = (lyricsText) => {
    if (!lyricsText) return "Letra não disponível";
    
    return lyricsText
      .split('\n')
      .map((line, lineIndex) => {
        if (!line.trim()) {
          return (
            <div key={lineIndex} className="mb-4" style={{ minHeight: '20px' }}>
              \u00A0
            </div>
          );
        }
        
        const parts = parseLineWithChords(line);
        
        return (
          <div 
            key={lineIndex} 
            className="lyrics-line mb-3 relative"
            style={{ 
              fontSize: `${fontSize}px`,
              lineHeight: '1.8',
              minHeight: '40px'
            }}
          >
            <div className="flex flex-wrap items-start">
              {parts.map((part, partIndex) => (
                <span key={partIndex} className="relative inline-block">
                  {part.type === 'chord' ? (
                    <>
                      <span 
                        className="absolute top-0 left-0 text-blue-600 font-bold text-sm transform -translate-y-6 bg-blue-50 px-1 rounded border border-blue-200"
                        style={{ 
                          fontSize: Math.max(12, fontSize - 2),
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {part.content}
                      </span>
                      <span className="invisible">{part.content}</span>
                    </>
                  ) : (
                    <span className="text-gray-800">{part.content}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      });
  };

  return (
    <div className="lyrics-scroll-container">
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
                
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Como usar:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Clique "Auto-Scroll" para iniciar</li>
                    <li>• Use os botões de velocidade para acelerar/desacelerar</li>
                    <li>• Ajuste a velocidade do scroll conforme necessário</li>
                    <li>• "Reiniciar" volta ao topo da letra</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Container das Letras */}
      <div 
        ref={lyricsRef}
        className="lyrics-display max-h-96 overflow-y-auto bg-white rounded-lg border p-4 shadow-sm"
        style={{ 
          scrollBehavior: isScrolling ? 'auto' : 'smooth',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
        }}
      >
        <div className="font-mono text-gray-800 leading-relaxed">
          {formatLyrics(lyrics)}
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
  );
};

export default LyricsAutoScroll;