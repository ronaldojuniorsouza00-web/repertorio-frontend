import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import socketService from './services/socket';
import PWAInstall from './components/PWAInstall';
import '@/App.css';

// Pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext(null);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// API Service
export const api = {
  // Auth
  register: async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    return response.data;
  },
  login: async (credentials) => {
    const response = await axios.post(`${API}/auth/login`, credentials);
    return response.data;
  },
  
  // Songs  
  searchSong: async (songData, token) => {
    const response = await axios.post(`${API}/songs/search`, songData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getSong: async (songId, token) => {
    const response = await axios.get(`${API}/songs/${songId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getInstrumentNotation: async (songId, instrument, token) => {
    const response = await axios.get(`${API}/songs/${songId}/notation/${instrument}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  
  // Rooms
  createRoom: async (roomData, token) => {
    const response = await axios.post(`${API}/rooms/create`, roomData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  joinRoom: async (joinData, token) => {
    const response = await axios.post(`${API}/rooms/join`, joinData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getRoom: async (roomId, token) => {
    const response = await axios.get(`${API}/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  setCurrentSong: async (roomId, songId, token) => {
    const response = await axios.post(`${API}/rooms/${roomId}/set-current-song?song_id=${songId}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  setNextSong: async (roomId, songId, token) => {
    const response = await axios.post(`${API}/rooms/${roomId}/set-next-song?song_id=${songId}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  transposeRoom: async (roomId, transposeData, token) => {
    const response = await axios.post(`${API}/rooms/${roomId}/transpose`, transposeData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  transposeSong: async (songId, transposeData, token) => {
    const response = await axios.post(`${API}/songs/${songId}/transpose`, transposeData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  
  // Instruments
  getInstruments: async () => {
    const response = await axios.get(`${API}/instruments`);
    return response.data;
  },
  
  // Recommendations
  getRecommendations: async (roomId, token) => {
    const response = await axios.get(`${API}/rooms/${roomId}/recommendations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setToken(storedToken);
        
        // Connect to socket with stored token
        socketService.connect(storedToken);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = (authData) => {
    setUser(authData.user);
    setToken(authData.access_token);
    localStorage.setItem('user', JSON.stringify(authData.user));
    localStorage.setItem('token', authData.access_token);
    
    // Connect to socket
    socketService.connect(authData.access_token);
    
    toast.success('Login realizado com sucesso!');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Disconnect socket
    socketService.disconnect();
    
    toast.success('Logout realizado com sucesso!');
  };

  const authContextValue = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route 
              path="/auth" 
              element={!authContextValue.isAuthenticated ? <Auth /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/dashboard" 
              element={authContextValue.isAuthenticated ? <Dashboard /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/room/:roomId" 
              element={authContextValue.isAuthenticated ? <Room /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/" 
              element={<Navigate to={authContextValue.isAuthenticated ? "/dashboard" : "/auth"} />} 
            />
          </Routes>
          <PWAInstall />
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;