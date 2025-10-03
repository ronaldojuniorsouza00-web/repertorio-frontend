import requests
import sys
import json
import time
from datetime import datetime

class MusicMaestroAPITester:
    def __init__(self, base_url="https://songmate-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.room_id = None
        self.song_id = None
        self.recording_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_basic_health(self):
        """Test basic API health"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_register(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            print(f"   Registered user: {self.user_data['name']}")
            return True
        return False

    def test_login(self):
        """Test user login with existing user"""
        if not self.user_data:
            return False
            
        login_data = {
            "email": self.user_data['email'],
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_instruments_removed(self):
        """Test that instruments endpoint returns 404 (removed)"""
        success, response = self.run_test(
            "Instruments Endpoint Removed",
            "GET",
            "instruments",
            404
        )
        
        if success:
            print(f"   ✅ Instruments endpoint correctly returns 404 (removed)")
            return True
        return False

    def test_search_song(self):
        """Test song search functionality"""
        song_data = {
            "title": "Imagine",
            "artist": "John Lennon"
        }
        
        success, response = self.run_test(
            "Search Song",
            "POST",
            "songs/search",
            200,
            data=song_data
        )
        
        if success and 'id' in response:
            self.song_id = response['id']
            print(f"   Found song: {response['title']} by {response['artist']}")
            return True
        return False

    def test_get_song(self):
        """Test getting song by ID"""
        if not self.song_id:
            return False
            
        success, response = self.run_test(
            "Get Song by ID",
            "GET",
            f"songs/{self.song_id}",
            200
        )
        
        if success and 'id' in response:
            print(f"   Retrieved song: {response['title']}")
            return True
        return False

    def test_instrument_notation_removed(self):
        """Test that instrument notation endpoint returns 404 (removed)"""
        if not self.song_id:
            return False
            
        success, response = self.run_test(
            "Instrument Notation Endpoint Removed",
            "GET",
            f"songs/{self.song_id}/notation/Violão",
            404
        )
        
        if success:
            print(f"   ✅ Instrument notation endpoint correctly returns 404 (removed)")
            return True
        return False

    def test_create_room(self):
        """Test room creation"""
        room_data = {
            "name": f"Test Room {int(time.time())}"
        }
        
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms/create",
            200,
            data=room_data
        )
        
        if success and 'id' in response:
            self.room_id = response['id']
            print(f"   Created room: {response['name']} (Code: {response['code']})")
            return True
        return False

    def test_join_room(self):
        """Test joining a room"""
        if not self.room_id:
            return False
            
        # First get room details to get the code
        success, room_data = self.run_test(
            "Get Room Details",
            "GET",
            f"rooms/{self.room_id}",
            200
        )
        
        if not success:
            return False
            
        join_data = {
            "room_code": room_data['room']['code']
            # No instrument field needed anymore
        }
        
        success, response = self.run_test(
            "Join Room",
            "POST",
            "rooms/join",
            200,
            data=join_data
        )
        
        if success:
            print(f"   Joined room successfully")
            return True
        return False

    def test_set_current_song(self):
        """Test setting current song in room"""
        if not self.room_id or not self.song_id:
            return False
            
        success, response = self.run_test(
            "Set Current Song",
            "POST",
            f"rooms/{self.room_id}/set-current-song?song_id={self.song_id}",
            200,
            data={}
        )
        
        if success:
            print(f"   Set current song successfully")
            return True
        return False

    def test_set_next_song(self):
        """Test setting next song in room"""
        if not self.room_id or not self.song_id:
            return False
            
        success, response = self.run_test(
            "Set Next Song",
            "POST",
            f"rooms/{self.room_id}/set-next-song?song_id={self.song_id}",
            200,
            data={}
        )
        
        if success:
            print(f"   Set next song successfully")
            return True
        return False

    def test_get_recommendations(self):
        """Test AI recommendations"""
        if not self.room_id:
            return False
            
        success, response = self.run_test(
            "Get AI Recommendations",
            "GET",
            f"rooms/{self.room_id}/recommendations",
            200
        )
        
        if success and 'recommendations' in response:
            print(f"   Got {len(response['recommendations'])} recommendations")
            return True
        return False

    def test_start_recording(self):
        """Test starting a collaborative recording"""
        if not self.room_id:
            return False
            
        recording_data = {
            "recording_name": f"Test Recording {int(time.time())}"
        }
        
        success, response = self.run_test(
            "Start Recording",
            "POST",
            f"rooms/{self.room_id}/start-recording",
            200,
            data=recording_data
        )
        
        if success and 'recording_id' in response:
            self.recording_id = response['recording_id']
            print(f"   Started recording: {response['recording']['recording_name']}")
            return True
        return False

    def test_stop_recording(self):
        """Test stopping a recording with duration"""
        if not self.room_id or not self.recording_id:
            return False
            
        duration = 30  # 30 seconds test duration
        
        success, response = self.run_test(
            "Stop Recording",
            "POST",
            f"rooms/{self.room_id}/stop-recording/{self.recording_id}?duration={duration}",
            200
        )
        
        if success and 'recording' in response:
            print(f"   Stopped recording with duration: {duration}s")
            return True
        return False

    def test_get_recordings(self):
        """Test getting all recordings for a room"""
        if not self.room_id:
            return False
            
        success, response = self.run_test(
            "Get Recordings",
            "GET",
            f"rooms/{self.room_id}/recordings",
            200
        )
        
        if success and 'recordings' in response:
            print(f"   Found {len(response['recordings'])} recordings")
            return True
        return False

    def test_play_recording(self):
        """Test playing a recording"""
        if not self.room_id or not self.recording_id:
            return False
            
        success, response = self.run_test(
            "Play Recording",
            "POST",
            f"rooms/{self.room_id}/recordings/{self.recording_id}/play",
            200
        )
        
        if success:
            print(f"   Recording playback started")
            return True
        return False

    def test_pause_recording(self):
        """Test pausing a recording"""
        if not self.room_id or not self.recording_id:
            return False
            
        success, response = self.run_test(
            "Pause Recording",
            "POST",
            f"rooms/{self.room_id}/recordings/{self.recording_id}/pause",
            200
        )
        
        if success:
            print(f"   Recording playback paused")
            return True
        return False

    def test_set_recording_volume(self):
        """Test setting recording volume"""
        if not self.room_id or not self.recording_id:
            return False
            
        volume = 0.7  # 70% volume
        
        success, response = self.run_test(
            "Set Recording Volume",
            "POST",
            f"rooms/{self.room_id}/recordings/{self.recording_id}/volume?volume={volume}",
            200
        )
        
        if success:
            print(f"   Recording volume set to {volume}")
            return True
        return False

    def test_delete_recording(self):
        """Test deleting a recording"""
        if not self.room_id or not self.recording_id:
            return False
            
        success, response = self.run_test(
            "Delete Recording",
            "DELETE",
            f"rooms/{self.room_id}/recordings/{self.recording_id}",
            200
        )
        
        if success:
            print(f"   Recording deleted successfully")
            return True
        return False

    # NEW FUNCTIONALITY TESTS
    def test_enhanced_search(self):
        """Test enhanced search with AI fallback"""
        test_songs = [
            {"title": "Imagine", "artist": "John Lennon"},
            {"title": "Yesterday", "artist": "The Beatles"},
            {"title": "Let It Be", "artist": "The Beatles"}
        ]
        
        all_passed = True
        self.enhanced_song_ids = []
        
        for song_data in test_songs:
            success, response = self.run_test(
                f"Enhanced Search - {song_data['title']}",
                "POST",
                "songs/search-enhanced",
                200,
                data=song_data
            )
            
            if success and 'id' in response:
                self.enhanced_song_ids.append(response['id'])
                print(f"   Found song with enhanced search: {response['title']} by {response['artist']}")
                print(f"   Has lyrics: {'Yes' if response.get('lyrics') else 'No'}")
                print(f"   Has chords: {'Yes' if response.get('chords') else 'No'}")
            else:
                all_passed = False
                
        return all_passed

    def test_save_repertoire(self):
        """Test saving current repertoire to history"""
        if not self.room_id or not hasattr(self, 'enhanced_song_ids') or not self.enhanced_song_ids:
            return False
            
        repertoire_data = {
            "name": f"Test Repertoire {int(time.time())}",
            "song_ids": self.enhanced_song_ids[:2]  # Use first 2 songs
        }
        
        success, response = self.run_test(
            "Save Repertoire to History",
            "POST",
            f"rooms/{self.room_id}/repertoire/save",
            200,
            data=repertoire_data
        )
        
        if success and 'repertoire_id' in response:
            self.repertoire_id = response['repertoire_id']
            print(f"   Saved repertoire with {len(repertoire_data['song_ids'])} songs")
            return True
        return False

    def test_get_repertoire_history(self):
        """Test getting repertoire history"""
        if not self.room_id:
            return False
            
        success, response = self.run_test(
            "Get Repertoire History",
            "GET",
            f"rooms/{self.room_id}/repertoire/history",
            200
        )
        
        if success and 'repertoires' in response:
            print(f"   Found {len(response['repertoires'])} repertoires in history")
            return True
        return False

    def test_load_repertoire(self):
        """Test loading repertoire from history"""
        if not self.room_id or not hasattr(self, 'repertoire_id'):
            return False
            
        success, response = self.run_test(
            "Load Repertoire from History",
            "POST",
            f"rooms/{self.room_id}/repertoire/{self.repertoire_id}/load",
            200
        )
        
        if success and 'song_count' in response:
            print(f"   Loaded repertoire with {response['song_count']} songs")
            return True
        return False

    def test_speed_control(self):
        """Test speed/tempo control"""
        if not self.room_id:
            return False
            
        # Test increasing tempo
        speed_data = {"tempo_change": 10}  # +10 BPM
        
        success, response = self.run_test(
            "Increase Room Tempo",
            "POST",
            f"rooms/{self.room_id}/speed/adjust",
            200,
            data=speed_data
        )
        
        if not success:
            return False
            
        print(f"   Increased tempo to {response.get('new_tempo', 'unknown')} BPM")
        
        # Test decreasing tempo
        speed_data = {"tempo_change": -15}  # -15 BPM
        
        success, response = self.run_test(
            "Decrease Room Tempo",
            "POST",
            f"rooms/{self.room_id}/speed/adjust",
            200,
            data=speed_data
        )
        
        if success:
            print(f"   Decreased tempo to {response.get('new_tempo', 'unknown')} BPM")
            return True
        return False

    def test_fast_repertoire_generation(self):
        """Test fast AI repertoire generation with caching"""
        if not self.room_id:
            return False
            
        repertoire_data = {
            "genre": "rock",
            "song_count": 5
        }
        
        success, response = self.run_test(
            "Fast Repertoire Generation",
            "POST",
            f"rooms/{self.room_id}/generate-repertoire-fast",
            200,
            data=repertoire_data
        )
        
        if success and 'songs' in response:
            print(f"   Generated {response.get('count', 0)} songs quickly")
            print(f"   Sample songs: {[song.get('title', 'Unknown') for song in response['songs'][:3]]}")
            return True
        return False

    def test_delete_repertoire(self):
        """Test deleting repertoire from history"""
        if not self.room_id or not hasattr(self, 'repertoire_id'):
            return False
            
        success, response = self.run_test(
            "Delete Repertoire from History",
            "DELETE",
            f"rooms/{self.room_id}/repertoire/{self.repertoire_id}",
            200
        )
        
        if success:
            print(f"   Repertoire deleted from history")
            return True
        return False

    def test_add_songs_to_playlist(self):
        """Test adding songs to room playlist"""
        if not self.room_id or not hasattr(self, 'enhanced_song_ids') or not self.enhanced_song_ids:
            return False
            
        all_passed = True
        for song_id in self.enhanced_song_ids[:2]:  # Add first 2 songs
            success, response = self.run_test(
                f"Add Song to Playlist",
                "POST",
                f"rooms/{self.room_id}/playlist/add/{song_id}",
                200
            )
            
            if success:
                print(f"   Added song to playlist (total: {response.get('playlist_length', 'unknown')})")
            else:
                all_passed = False
                
        return all_passed

    def test_get_playlist(self):
        """Test getting room playlist"""
        if not self.room_id:
            return False
            
        success, response = self.run_test(
            "Get Room Playlist",
            "GET",
            f"rooms/{self.room_id}/playlist",
            200
        )
        
        if success and 'playlist' in response:
            print(f"   Playlist has {len(response['playlist'])} songs")
            return True
        return False

def main():
    print("🎵 Music Maestro API Testing Suite")
    print("=" * 50)
    
    tester = MusicMaestroAPITester()
    
    # Test sequence - focusing on NEW functionality as requested
    tests = [
        ("Basic Health Check", tester.test_basic_health),
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Create Room", tester.test_create_room),
        ("Join Room (No Instrument)", tester.test_join_room),
        
        # NEW FUNCTIONALITY TESTS - Main Focus
        ("Enhanced Search System", tester.test_enhanced_search),
        ("Add Songs to Playlist", tester.test_add_songs_to_playlist),
        ("Get Room Playlist", tester.test_get_playlist),
        ("Save Repertoire to History", tester.test_save_repertoire),
        ("Get Repertoire History", tester.test_get_repertoire_history),
        ("Load Repertoire from History", tester.test_load_repertoire),
        ("Speed Control - Tempo Adjustment", tester.test_speed_control),
        ("Fast Repertoire Generation", tester.test_fast_repertoire_generation),
        ("Delete Repertoire from History", tester.test_delete_repertoire),
        
        # Previous functionality (brief check)
        ("Instruments Endpoint Removed", tester.test_instruments_removed),
        ("Start Recording", tester.test_start_recording),
        ("Stop Recording", tester.test_stop_recording),
        ("Get Recordings", tester.test_get_recordings),
        ("Play Recording", tester.test_play_recording),
        ("Pause Recording", tester.test_pause_recording),
        ("Set Recording Volume", tester.test_set_recording_volume),
        ("Delete Recording", tester.test_delete_recording),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())