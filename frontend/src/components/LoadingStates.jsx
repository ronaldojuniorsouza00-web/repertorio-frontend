import React from 'react';
import { Loader2, Music, Sparkles, Brain, Search } from 'lucide-react';

export const SmartLoading = ({ type, message, progress = 0 }) => {
  const getLoadingConfig = (type) => {
    switch (type) {
      case 'song_search':
        return {
          icon: <Music className="w-6 h-6 animate-pulse" />,
          color: 'blue',
          defaultMessage: 'Buscando música...'
        };
      case 'ai_repertoire':
        return {
          icon: <Brain className="w-6 h-6 animate-bounce" />,
          color: 'purple',
          defaultMessage: 'IA criando repertório...'
        };
      case 'intelligent_search':
        return {
          icon: <Sparkles className="w-6 h-6 animate-spin" />,
          color: 'yellow',
          defaultMessage: 'Busca inteligente...'
        };
      case 'recommendations':
        return {
          icon: <Loader2 className="w-6 h-6 animate-spin" />,
          color: 'green',
          defaultMessage: 'Gerando recomendações...'
        };
      default:
        return {
          icon: <Loader2 className="w-6 h-6 animate-spin" />,
          color: 'blue',
          defaultMessage: 'Processando...'
        };
    }
  };

  const config = getLoadingConfig(type);
  const displayMessage = message || config.defaultMessage;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      {/* Animated icon */}
      <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-${config.color}-500 to-${config.color}-600 flex items-center justify-center text-white shadow-lg`}>
        {config.icon}
      </div>
      
      {/* Loading message */}
      <div className="text-center space-y-2">
        <p className="font-medium text-gray-900">{displayMessage}</p>
        
        {/* Progress bar if progress > 0 */}
        {progress > 0 && (
          <div className="w-48 bg-gray-200 rounded-full h-2">
            <div 
              className={`bg-gradient-to-r from-${config.color}-500 to-${config.color}-600 h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        
        {/* Loading dots animation */}
        <div className="flex justify-center space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 bg-${config.color}-500 rounded-full animate-bounce`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
      
      {/* Tips based on loading type */}
      <div className={`text-xs text-${config.color}-600 bg-${config.color}-50 px-3 py-2 rounded-full max-w-xs text-center`}>
        {type === 'ai_repertoire' && '🎵 Criando repertório personalizado...'}
        {type === 'song_search' && '🔍 Buscando em Spotify + Genius...'}
        {type === 'intelligent_search' && '🧠 IA analisando sua busca...'}
        {type === 'recommendations' && '💡 Analisando estilo musical...'}
        {!['ai_repertoire', 'song_search', 'intelligent_search', 'recommendations'].includes(type) && '⏳ Aguarde um momento...'}
      </div>
    </div>
  );
};

export const QuickLoading = ({ message = "Carregando..." }) => (
  <div className="flex items-center justify-center space-x-2 py-4">
    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
    <span className="text-sm text-gray-600">{message}</span>
  </div>
);

export const InlineLoading = ({ message = "Processando...", size = "sm" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5", 
    lg: "w-6 h-6"
  };

  return (
    <div className="flex items-center space-x-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      <span className="text-sm text-gray-600">{message}</span>
    </div>
  );
};