import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { SkipForward, Play, Music } from 'lucide-react';

const NextSongBar = ({ 
  nextSong, 
  isAdmin, 
  onPlayNext, 
  onAdvancePlaylist,
  className = ""
}) => {
  if (!nextSong) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-orange-200 shadow-lg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Next song info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <SkipForward className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-orange-600 whitespace-nowrap">
                Próxima:
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate text-sm">
                {nextSong.title}
              </h4>
              <p className="text-gray-600 text-xs truncate">
                por {nextSong.artist}
              </p>
            </div>
            
            {/* Badges */}
            <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                {nextSong.key}
              </Badge>
              <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                {nextSong.genre}
              </Badge>
              {nextSong.tempo && (
                <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                  {nextSong.tempo} BPM
                </Badge>
              )}
            </div>
          </div>
          
          {/* Admin controls */}
          {isAdmin && (
            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
              <Button
                onClick={onPlayNext}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1"
                data-testid="play-next-button-bar"
              >
                <Play className="w-3 h-3 mr-1" />
                Tocar
              </Button>
              <Button
                onClick={onAdvancePlaylist}
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 text-xs px-3 py-1"
                data-testid="advance-playlist-button-bar"
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Avançar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NextSongBar;