import requests
import sys
import json
import time
from datetime import datetime

class MusicMaestroAPITester:
    def __init__(self, base_url="https://musica-maestro.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.room_id = None
        self.song_id = None

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

    def test_get_instruments(self):
        """Test getting available instruments"""
        success, response = self.run_test(
            "Get Instruments",
            "GET",
            "instruments",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   Found {len(response)} instruments")
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

    def test_get_instrument_notation(self):
        """Test getting instrument-specific notation"""
        if not self.song_id:
            return False
            
        success, response = self.run_test(
            "Get Instrument Notation",
            "GET",
            f"songs/{self.song_id}/notation/Violão",
            200
        )
        
        if success and 'notation' in response:
            print(f"   Got notation for {response['instrument']}")
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
            "room_code": room_data['room']['code'],
            "instrument": "Violão"
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

def main():
    print("🎵 Music Maestro API Testing Suite")
    print("=" * 50)
    
    tester = MusicMaestroAPITester()
    
    # Test sequence
    tests = [
        ("Basic Health Check", tester.test_basic_health),
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Get Instruments", tester.test_get_instruments),
        ("Search Song", tester.test_search_song),
        ("Get Song by ID", tester.test_get_song),
        ("Get Instrument Notation", tester.test_get_instrument_notation),
        ("Create Room", tester.test_create_room),
        ("Join Room", tester.test_join_room),
        ("Set Current Song", tester.test_set_current_song),
        ("Set Next Song", tester.test_set_next_song),
        ("Get AI Recommendations", tester.test_get_recommendations),
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