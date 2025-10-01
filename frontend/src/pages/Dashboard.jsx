import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Music, Users, Plus, LogOut, Guitar } from 'lucide-react';
import { toast } from 'sonner';
import { api, useAuth } from '../App';
// InstrumentSelector removed - no longer needed for collaborative system

const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [createRoomForm, setCreateRoomForm] = useState({
    name: ''
  });
  
  const [joinRoomForm, setJoinRoomForm] = useState({
    room_code: '',
    instrument: ''
  });
  
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState('');

  useEffect(() => {
    loadInstruments();
  }, []);

  const loadInstruments = async () => {
    try {
      const instrumentsData = await api.getInstruments();
      setInstruments(instrumentsData);
    } catch (error) {
      console.error('Error loading instruments:', error);
      toast.error('Erro ao carregar instrumentos');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!createRoomForm.name.trim()) {
      toast.error('Por favor, digite o nome da sala');
      return;
    }
    
    setLoading(true);
    try {
      const room = await api.createRoom(createRoomForm, token);
      toast.success('Sala criada com sucesso!');
      navigate(`/room/${room.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Erro ao criar sala');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinRoomForm.room_code.trim()) {
      toast.error('Por favor, digite o código da sala');
      return;
    }
    
    // Show instrument selector
    setPendingRoomCode(joinRoomForm.room_code);
    setShowInstrumentSelector(true);
  };
  
  const handleInstrumentSelected = async (instrument) => {
    setShowInstrumentSelector(false);
    
    const joinData = {
      room_code: pendingRoomCode,
      instrument: instrument.name
    };
    
    setLoading(true);
    try {
      const response = await api.joinRoom(joinData, token);
      toast.success(`Entrou na sala como ${instrument.name}!`);
      navigate(`/room/${response.room.id}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error('Erro ao entrar na sala. Verifique o código.');
    } finally {
      setLoading(false);
      setPendingRoomCode('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Music className="w-8 h-8 text-amber-600" />
              <h1 className="text-2xl font-bold text-gray-900 font-['Inter']">Music Maestro</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Olá, {user.name}!</span>
              <Button 
                onClick={logout}
                variant="outline" 
                size="sm"
                className="border-amber-200 hover:bg-amber-50"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 font-['Inter']">
            Pronto para tocar?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Crie uma nova sala ou entre em uma sala existente para começar a tocar com sua banda
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {/* Create Room */}
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Criar Nova Sala</CardTitle>
              <p className="text-gray-600">Seja o líder da banda e crie um repertório colaborativo</p>
            </CardHeader>
            <CardContent>
              <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white py-3"
                    data-testid="create-room-button"
                  >
                    Criar Sala
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Sala</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateRoom} className="space-y-4" data-testid="create-room-form">
                    <div className="space-y-2">
                      <Label htmlFor="room-name">Nome da Sala</Label>
                      <Input
                        id="room-name"
                        type="text"
                        placeholder="Ex: Ensaio da Banda, Show do Bar..."
                        value={createRoomForm.name}
                        onChange={(e) => setCreateRoomForm({...createRoomForm, name: e.target.value})}
                        className="border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                        data-testid="room-name-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                      disabled={loading}
                      data-testid="create-room-submit-button"
                    >
                      {loading ? 'Criando...' : 'Criar Sala'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Entrar em Sala</CardTitle>
              <p className="text-gray-600">Digite o código da sala e escolha seu instrumento</p>
            </CardHeader>
            <CardContent>
              <Dialog open={showJoinRoom} onOpenChange={setShowJoinRoom}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-3"
                    data-testid="join-room-button"
                  >
                    Entrar na Sala
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle>Entrar na Sala</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleJoinRoom} className="space-y-4" data-testid="join-room-form">
                    <div className="space-y-2">
                      <Label htmlFor="room-code">Código da Sala</Label>
                      <Input
                        id="room-code"
                        type="text"
                        placeholder="Ex: ABC123"
                        value={joinRoomForm.room_code}
                        onChange={(e) => setJoinRoomForm({...joinRoomForm, room_code: e.target.value.toUpperCase()})}
                        className="border-amber-200 focus:border-amber-500 focus:ring-amber-500 uppercase"
                        data-testid="room-code-input"
                      />
                    </div>
                    
                    <p className="text-gray-600 text-center">
                      Digite o código da sala para entrar e começar a tocar
                    </p>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                      disabled={loading}
                      data-testid="join-room-submit-button"
                    >
                      {loading ? 'Entrando...' : 'Entrar na Sala'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Instruments Info */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Instrumentos Suportados
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {instruments.map((instrument) => (
              <div 
                key={instrument.name} 
                className="text-center p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-amber-200/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                  <Guitar className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm">{instrument.name}</h4>
                <p className="text-xs text-gray-600">{instrument.category}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Instrument Selector Modal */}
        <InstrumentSelector
          isOpen={showInstrumentSelector}
          onSelect={handleInstrumentSelected}
          onClose={() => {
            setShowInstrumentSelector(false);
            setPendingRoomCode('');
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;