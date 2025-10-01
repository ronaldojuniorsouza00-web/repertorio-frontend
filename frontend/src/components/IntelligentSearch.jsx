import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Search, Sparkles, Music, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';
import { SmartLoading } from './LoadingStates';

const IntelligentSearch = ({ onSongSelect, isOpen, onClose }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);

  const handleIntelligentSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Digite algo para buscar');
      return;
    }

    setSearching(true);
    try {
      const response = await api.intelligentSearch(query, token);
      setSearchResults(response.results);
      
      if (response.results.length === 0) {
        toast.info('Nenhuma música encontrada. Tente termos diferentes.');
      } else {
        toast.success(`${response.results.length} músicas encontradas!`);
      }
    } catch (error) {
      console.error('Error in intelligent search:', error);
      toast.error('Erro na busca inteligente');
    } finally {
      setSearching(false);
    }
  };

  const handleAddSong = async (song) => {
    setAdding(song.title);
    try {
      const addedSong = await api.searchSong({
        title: song.title,
        artist: song.artist
      }, token);
      
      toast.success(`${song.title} adicionada com sucesso!`);
      
      if (onSongSelect) {
        onSongSelect(addedSong);
      }
      
      onClose();
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error('Erro ao adicionar música');
    } finally {
      setAdding(null);
    }
  };

  const getYearBadgeColor = (year) => {
    const yearNum = parseInt(year);
    if (yearNum >= 2020) return 'bg-green-100 text-green-800';
    if (yearNum >= 2010) return 'bg-blue-100 text-blue-800';
    if (yearNum >= 2000) return 'bg-purple-100 text-purple-800';
    if (yearNum >= 1990) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPopularityStars = (popularity) => {
    const stars = Math.round(popularity / 2);
    return '⭐'.repeat(stars);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
            Busca Inteligente de Músicas
          </DialogTitle>
          <p className="text-gray-600">
            Digite o nome da música, artista, ou descreva o que você está procurando
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Form */}
          <form onSubmit={handleIntelligentSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Ex: 'Yesterday Beatles', 'música romântica dos anos 80', 'rock nacional'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 border-purple-200 focus:border-purple-500 focus:ring-purple-500"
                data-testid="intelligent-search-input"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={searching}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              data-testid="intelligent-search-button"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Buscar com IA
                </>
              )}
            </Button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Resultados Encontrados ({searchResults.length})
              </h3>
              
              <div className="overflow-y-auto max-h-96 space-y-3">
                {searchResults.map((song, index) => (
                  <Card 
                    key={index} 
                    className="hover:shadow-md transition-shadow border-purple-200/50"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-3">
                            <Music className="w-5 h-5 text-purple-600" />
                            <div>
                              <h4 className="font-semibold text-gray-900 text-lg">
                                {song.title}
                              </h4>
                              <p className="text-gray-600">
                                por <span className="font-medium">{song.artist}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 flex-wrap">
                            <Badge 
                              variant="outline"
                              className="border-purple-200 text-purple-700"
                            >
                              {song.genre}
                            </Badge>
                            
                            <Badge 
                              variant="outline"
                              className={getYearBadgeColor(song.year)}
                            >
                              {song.year}
                            </Badge>
                            
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-gray-500">
                                {getPopularityStars(song.popularity)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({song.popularity}/10)
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleAddSong(song)}
                          disabled={adding === song.title}
                          className="ml-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                          data-testid={`add-song-${song.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {adding === song.title ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Adicionar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* Search Tips */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-2">💡 Dicas de Busca:</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• <strong>Nome + Artista:</strong> "Imagine John Lennon"</li>
              <li>• <strong>Por gênero:</strong> "rock nacional anos 80"</li>
              <li>• <strong>Por descrição:</strong> "música romântica para casal"</li>
              <li>• <strong>Por época:</strong> "sucessos dos anos 90"</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntelligentSearch;