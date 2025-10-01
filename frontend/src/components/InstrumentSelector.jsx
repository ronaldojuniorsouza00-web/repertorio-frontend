import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Search, Music } from 'lucide-react';
import { api } from '../App';

const InstrumentSelector = ({ isOpen, onSelect, onClose }) => {
  const [instruments, setInstruments] = useState([]);
  const [filteredInstruments, setFilteredInstruments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  useEffect(() => {
    loadInstruments();
  }, []);
  
  useEffect(() => {
    filterInstruments();
  }, [instruments, searchTerm, selectedCategory]);
  
  const loadInstruments = async () => {
    try {
      const data = await api.getInstruments();
      setInstruments(data);
      setFilteredInstruments(data);
    } catch (error) {
      console.error('Error loading instruments:', error);
    }
  };
  
  const filterInstruments = () => {
    let filtered = instruments;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(instrument => 
        instrument.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(instrument =>
        instrument.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instrument.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredInstruments(filtered);
  };
  
  const categories = [...new Set(instruments.map(inst => inst.category))];
  
  const getInstrumentIcon = (category) => {
    const icons = {
      'Cordas': '🎸',
      'Teclas': '🎹', 
      'Percussão': '🥁',
      'Sopro': '🎷',
      'Vocal': '🎤',
      'Eletrônicos': '🎛️',
      'Outros': '🎵'
    };
    return icons[category] || '🎵';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Music className="w-6 h-6 mr-2 text-amber-600" />
            Selecione seu Instrumento
          </DialogTitle>
          <p className="text-gray-600">
            Escolha o instrumento que você tocará para receber notações específicas
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar instrumentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-amber-200 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className={selectedCategory === 'all' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-200 hover:bg-amber-50'}
              >
                Todos
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-200 hover:bg-amber-50'}
                >
                  {getInstrumentIcon(category)} {category}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Instruments Grid */}
          <div className="overflow-y-auto max-h-96">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInstruments.map((instrument) => (
                <Card 
                  key={instrument.name} 
                  className="hover:shadow-md transition-shadow cursor-pointer border-amber-200/50"
                  onClick={() => onSelect(instrument)}
                  data-testid={`instrument-${instrument.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getInstrumentIcon(instrument.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {instrument.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs border-amber-200 text-amber-700"
                          >
                            {instrument.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {instrument.notation_type === 'chords' && 'Acordes'}
                            {instrument.notation_type === 'notes' && 'Notas'}
                            {instrument.notation_type === 'rhythm' && 'Ritmo'}
                            {instrument.notation_type === 'lyrics' && 'Letras'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {filteredInstruments.length === 0 && (
              <div className="text-center py-8">
                <Music className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhum instrumento encontrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Tente ajustar sua busca ou filtros
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstrumentSelector;