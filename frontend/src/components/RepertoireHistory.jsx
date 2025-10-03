import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  History, 
  Save, 
  Play, 
  Trash2, 
  Clock,
  Music,
  User,
  List,
  Star,
  StarOff
} from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';

const RepertoireHistory = ({ roomId, currentPlaylist = [], isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [repertoires, setRepertoires] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveRepertoireName, setSaveRepertoireName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadRepertoireHistory();
    }
  }, [isOpen, roomId]);

  const loadRepertoireHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getRepertoireHistory(roomId, token);
      setRepertoires(response.repertoires);
    } catch (error) {
      console.error('Error loading repertoire history:', error);
      toast.error('Erro ao carregar histórico de repertórios');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentRepertoire = async () => {
    if (!saveRepertoireName.trim()) {
      toast.error('Por favor, digite um nome para o repertório');
      return;
    }

    if (currentPlaylist.length === 0) {
      toast.error('Não há músicas na playlist atual para salvar');
      return;
    }

    try {
      await api.saveRepertoire(roomId, {
        name: saveRepertoireName.trim(),
        song_ids: currentPlaylist
      }, token);
      
      toast.success('Repertório salvo com sucesso!');
      setSaveRepertoireName('');
      setShowSaveDialog(false);
      await loadRepertoireHistory();
      
    } catch (error) {
      console.error('Error saving repertoire:', error);
      toast.error('Erro ao salvar repertório');
    }
  };

  const loadRepertoire = async (repertoireId, repertoireName) => {
    try {
      await api.loadRepertoire(roomId, repertoireId, token);
      toast.success(`Repertório "${repertoireName}" carregado!`);
      onClose(); // Fechar modal
    } catch (error) {
      console.error('Error loading repertoire:', error);
      toast.error('Erro ao carregar repertório');
    }
  };

  const deleteRepertoire = async (repertoireId, repertoireName) => {
    if (!confirm(`Tem certeza que deseja excluir o repertório "${repertoireName}"?`)) {
      return;
    }

    try {
      await api.deleteRepertoire(roomId, repertoireId, token);
      toast.success('Repertório removido do histórico');
      await loadRepertoireHistory();
    } catch (error) {
      console.error('Error deleting repertoire:', error);
      toast.error('Erro ao remover repertório');
    }
  };

  const toggleFavorite = async (repertoireId) => {
    // Esta funcionalidade pode ser implementada no backend posteriormente
    toast.info('Funcionalidade de favoritos será implementada em breve');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <History className="w-6 h-6 mr-2 text-indigo-600" />
            Histórico de Repertórios
          </DialogTitle>
          <p className="text-gray-600">
            Gerencie seus repertórios salvos e carregue-os rapidamente
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Controles Superiores */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center">
                <List className="w-3 h-3 mr-1" />
                {repertoires.length} repertórios salvos
              </Badge>
              
              {currentPlaylist.length > 0 && (
                <Badge variant="outline" className="flex items-center text-green-600 border-green-200">
                  <Music className="w-3 h-3 mr-1" />
                  {currentPlaylist.length} músicas na playlist atual
                </Badge>
              )}
            </div>

            {/* Botão Salvar Repertório Atual */}
            {currentPlaylist.length > 0 && (
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Repertório Atual
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Salvar Repertório</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="repertoire-name">Nome do Repertório</Label>
                      <Input
                        id="repertoire-name"
                        type="text"
                        placeholder="Ex: Show de Domingo, Repertório Rock..."
                        value={saveRepertoireName}
                        onChange={(e) => setSaveRepertoireName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>{currentPlaylist.length} músicas</strong> serão salvas neste repertório.
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={saveCurrentRepertoire}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        disabled={!saveRepertoireName.trim()}
                      >
                        Salvar Repertório
                      </Button>
                      <Button
                        onClick={() => setShowSaveDialog(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Lista de Repertórios */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Carregando histórico...</p>
              </div>
            ) : repertoires.length > 0 ? (
              repertoires.map((repertoire) => (
                <div key={repertoire.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">{repertoire.name}</h3>
                        
                        {repertoire.is_favorite && (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        )}
                        
                        <Badge variant="outline" className="text-xs flex items-center">
                          <Music className="w-3 h-3 mr-1" />
                          {repertoire.songs.length} músicas
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {repertoire.created_by_name}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(repertoire.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Botão Favoritar */}
                      <Button
                        onClick={() => toggleFavorite(repertoire.id)}
                        size="sm"
                        variant="outline"
                        className="border-yellow-200 hover:bg-yellow-50"
                      >
                        {repertoire.is_favorite ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4 text-yellow-600" />
                        )}
                      </Button>

                      {/* Botão Carregar */}
                      <Button
                        onClick={() => loadRepertoire(repertoire.id, repertoire.name)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Carregar
                      </Button>

                      {/* Botão Deletar (apenas para criador) */}
                      {repertoire.created_by === user.id && (
                        <Button
                          onClick={() => deleteRepertoire(repertoire.id, repertoire.name)}
                          size="sm"
                          variant="outline"
                          className="border-red-200 hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Prévia das músicas (primeiras 3) */}
                  {repertoire.songs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Prévia do repertório:</p>
                      <div className="text-sm text-gray-600">
                        {repertoire.songs.slice(0, 3).map((songId, index) => (
                          <span key={songId}>
                            Música {index + 1}
                            {index < Math.min(2, repertoire.songs.length - 1) && ', '}
                          </span>
                        ))}
                        {repertoire.songs.length > 3 && (
                          <span className="text-gray-400"> e mais {repertoire.songs.length - 3}...</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <History className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum repertório salvo</h3>
                <p className="text-gray-500 mb-4">
                  Crie uma playlist e salve como repertório para acessar rapidamente depois
                </p>
                {currentPlaylist.length > 0 ? (
                  <p className="text-sm text-blue-600">
                    ✨ Você tem {currentPlaylist.length} músicas na playlist atual. Que tal salvá-las?
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">
                    Adicione algumas músicas à playlist atual primeiro
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepertoireHistory;