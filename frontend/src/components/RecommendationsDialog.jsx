import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Lightbulb, Plus, X, Music, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const RecommendationsDialog = ({ 
  isOpen, 
  onClose, 
  recommendations, 
  onAddToPlaylist, 
  loading 
}) => {
  const [selectedSongs, setSelectedSongs] = useState(new Set());
  const [step, setStep] = useState('select'); // 'select' or 'confirm'

  const handleSongToggle = (song, checked) => {
    const newSelected = new Set(selectedSongs);
    if (checked) {
      newSelected.add(song);
    } else {
      newSelected.delete(song);
    }
    setSelectedSongs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSongs.size === recommendations.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(recommendations));
    }
  };

  const handleProceed = () => {
    if (selectedSongs.size === 0) {
      toast.error('Selecione pelo menos uma música');
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    await onAddToPlaylist(Array.from(selectedSongs));
    setSelectedSongs(new Set());
    setStep('select');
  };

  const handleCancel = () => {
    setSelectedSongs(new Set());
    setStep('select');
    onClose();
  };

  const getArtistAndTitle = (songText) => {
    const parts = songText.split(' - ');
    return {
      title: parts[0]?.trim() || songText,
      artist: parts[1]?.trim() || 'Artista desconhecido'
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-600" />
            {step === 'select' ? 'Recomendações da IA' : 'Confirmar Adição ao Repertório'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            {/* Header with select all */}
            <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="select-all"
                  checked={selectedSongs.size === recommendations.length}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="font-medium text-yellow-800 cursor-pointer">
                  Selecionar todas ({recommendations.length} músicas)
                </label>
              </div>
              <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                {selectedSongs.size} selecionadas
              </Badge>
            </div>

            {/* Song list */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recommendations.length > 0 ? (
                recommendations.map((song, index) => {
                  const { title, artist } = getArtistAndTitle(song);
                  const isSelected = selectedSongs.has(song);
                  
                  return (
                    <Card 
                      key={index}
                      className={`transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? 'ring-2 ring-yellow-500 bg-yellow-50 border-yellow-300' 
                          : 'hover:shadow-md border-gray-200 hover:border-yellow-200'
                      }`}
                      onClick={() => handleSongToggle(song, !isSelected)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSongToggle(song, checked)}
                          />
                          
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{title}</h4>
                              <p className="text-gray-600 text-sm">por {artist}</p>
                            </div>
                          </div>
                          
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Music className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Nenhuma recomendação disponível</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="border-gray-300"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              
              <Button
                onClick={handleProceed}
                disabled={selectedSongs.size === 0}
                className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar {selectedSongs.size > 0 ? `(${selectedSongs.size})` : ''} ao Repertório
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            {/* Confirmation message */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Confirmar Adição ao Repertório
                </h3>
                <p className="text-gray-600">
                  {selectedSongs.size} {selectedSongs.size === 1 ? 'música será adicionada' : 'músicas serão adicionadas'} ao repertório principal da sala.
                </p>
              </div>
            </div>

            {/* Selected songs preview */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-48 overflow-y-auto">
              <h4 className="font-semibold text-green-800 mb-3">Músicas Selecionadas:</h4>
              <div className="space-y-2">
                {Array.from(selectedSongs).map((song, index) => {
                  const { title, artist } = getArtistAndTitle(song);
                  return (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-green-800">{title}</span>
                      <span className="text-green-600">por {artist}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmation actions */}
            <div className="flex justify-between">
              <Button
                onClick={() => setStep('select')}
                variant="outline"
                className="border-gray-300"
              >
                Voltar para Seleção
              </Button>
              
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {loading ? 'Adicionando...' : 'Confirmar e Adicionar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationsDialog;