import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    if (this.socket) {
      return this.socket;
    }

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    
    this.socket = io(BACKEND_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      upgrade: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Room management
  joinRoom(roomId, userId, userName) {
    if (this.socket) {
      this.socket.emit('join_room', {
        room_id: roomId,
        user_id: userId,
        user_name: userName
      });
    }
  }

  leaveRoom(roomId, userId) {
    if (this.socket) {
      this.socket.emit('leave_room', {
        room_id: roomId,
        user_id: userId
      });
    }
  }

  // Song management
  emitSongChange(roomId, song) {
    if (this.socket) {
      this.socket.emit('song_changed', {
        room_id: roomId,
        song: song
      });
    }
  }

  emitTransposeChange(roomId, newKey) {
    if (this.socket) {
      this.socket.emit('transpose_changed', {
        room_id: roomId,
        new_key: newKey
      });
    }
  }

  // Event listeners
  onUserJoined(callback) {
    if (this.socket) {
      this.socket.on('user_joined', callback);
    }
  }

  onUserLeft(callback) {
    if (this.socket) {
      this.socket.on('user_left', callback);
    }
  }

  onSongChanged(callback) {
    if (this.socket) {
      this.socket.on('song_changed', callback);
    }
  }

  onTransposeChanged(callback) {
    if (this.socket) {
      this.socket.on('transpose_changed', callback);
    }
  }

  onRoomSync(callback) {
    if (this.socket) {
      this.socket.on('room_sync', callback);
    }
  }

  // Collaborative Recording Events
  onRecordingStarted(callback) {
    if (this.socket) {
      this.socket.on('recording_started', callback);
    }
  }

  onRecordingStopped(callback) {
    if (this.socket) {
      this.socket.on('recording_stopped', callback);
    }
  }

  onRecordingPlay(callback) {
    if (this.socket) {
      this.socket.on('recording_play', callback);
    }
  }

  onRecordingPause(callback) {
    if (this.socket) {
      this.socket.on('recording_pause', callback);
    }
  }

  onRecordingVolumeChanged(callback) {
    if (this.socket) {
      this.socket.on('recording_volume_changed', callback);
    }
  }

  onRecordingDeleted(callback) {
    if (this.socket) {
      this.socket.on('recording_deleted', callback);
    }
  }

  // Repertoire Events
  onPlaylistLoaded(callback) {
    if (this.socket) {
      this.socket.on('playlist_loaded', callback);
    }
  }

  onTempoChanged(callback) {
    if (this.socket) {
      this.socket.on('tempo_changed', callback);
    }
  }

  // Remove listeners
  removeListener(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();