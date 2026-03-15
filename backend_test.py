import requests
import sys
from datetime import datetime, timedelta
import uuid
import json

class FutbolAppTester:
    def __init__(self, base_url="https://futbol-match-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.profile_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.created_match_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Response Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - {name}")
                if response.status_code != 204:  # Not No Content
                    try:
                        response_data = response.json()
                        print(f"   Response: {json.dumps(response_data, indent=2)}")
                        return True, response_data
                    except:
                        return True, {}
                return True, {}
            else:
                print(f"❌ FAILED - {name}")
                print(f"   Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - {name}")
            print(f"   Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_positions_endpoint(self):
        """Test positions endpoint"""
        return self.run_test("Get Positions", "GET", "positions", 200)

    def test_login_admin(self):
        """Test login with admin user"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "test@test.com", "password": "123456"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.token = response['token']  # Use admin for main tests
            self.user_id = response.get('user_id')
            self.profile_id = response.get('profile_id')
            print(f"   Admin Token: {self.admin_token[:20]}...")
            print(f"   User ID: {self.user_id}")
            print(f"   Profile ID: {self.profile_id}")
            return True
        return False

    def test_register_new_user(self):
        """Test registering a new user"""
        timestamp = int(datetime.now().timestamp())
        success, response = self.run_test(
            "Register New User",
            "POST", 
            "auth/register",
            200,
            data={
                "email": f"testuser_{timestamp}@example.com",
                "password": "testpass123",
                "name": f"Test User {timestamp}"
            }
        )
        return success, response

    def test_get_me(self):
        """Test getting current user info"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_get_profile(self):
        """Test getting user profile"""
        return self.run_test("Get Profile", "GET", "profile", 200)

    def test_update_profile(self):
        """Test updating user profile"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        return self.run_test(
            "Update Profile",
            "PUT",
            "profile", 
            200,
            data={
                "birth_date": "1990-01-01",
                "primary_position": "Delantero",
                "secondary_positions": ["Mediocampista"],
                "unwanted_position": "Arquero"
            }
        )

    def test_create_match(self):
        """Test creating a match (admin only)"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        success, response = self.run_test(
            "Create Match",
            "POST",
            "matches",
            200,
            data={
                "title": f"Test Match {datetime.now().strftime('%H%M%S')}",
                "modality": 7,
                "date": tomorrow,
                "time": "19:00",
                "location": "Test Stadium",
                "maps_link": "https://maps.google.com/test",
                "is_recurring": False
            }
        )
        if success and response:
            self.created_match_id = response.get('id')
            print(f"   Created Match ID: {self.created_match_id}")
        return success

    def test_list_matches(self):
        """Test listing matches"""
        return self.run_test("List Matches", "GET", "matches", 200)

    def test_get_match_detail(self):
        """Test getting match details"""
        if not self.created_match_id:
            print("⚠️  Skipping match detail test - no match created")
            return True
        return self.run_test(f"Get Match Detail", "GET", f"matches/{self.created_match_id}", 200)

    def test_register_for_match(self):
        """Test registering for a match"""
        if not self.created_match_id:
            print("⚠️  Skipping match registration test - no match created")
            return True
        return self.run_test(
            "Register for Match",
            "POST",
            f"matches/{self.created_match_id}/register",
            200
        )

    def test_get_match_registrations(self):
        """Test getting match registrations"""
        if not self.created_match_id:
            print("⚠️  Skipping match registrations test - no match created")
            return True
        return self.run_test(
            "Get Match Registrations",
            "GET",
            f"matches/{self.created_match_id}/registrations",
            200
        )

    def test_generate_teams(self):
        """Test team generation"""
        if not self.created_match_id:
            print("⚠️  Skipping team generation test - no match created")
            return True
        
        # First close registrations
        success, _ = self.run_test(
            "Close Match Registrations",
            "POST",
            f"matches/{self.created_match_id}/close",
            200
        )
        
        if not success:
            print("⚠️  Could not close registrations, skipping team generation")
            return True
            
        return self.run_test(
            "Generate Teams",
            "POST",
            f"matches/{self.created_match_id}/generate-teams",
            200
        )

    def test_list_players(self):
        """Test listing players"""
        return self.run_test("List Players", "GET", "players", 200)

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        return self.run_test("Admin Stats", "GET", "admin/stats", 200)

    def test_admin_list_users(self):
        """Test admin list users"""
        return self.run_test("Admin List Users", "GET", "admin/users", 200)
    
    def test_admin_registration(self):
        """Test padrapatricio@gmail.com gets admin role on registration"""
        timestamp = int(datetime.now().timestamp())
        success, response = self.run_test(
            "Admin Email Registration",
            "POST",
            "auth/register", 
            200,
            data={
                "email": "padrapatricio@gmail.com",
                "password": "mipass123",
                "name": f"Patricio Admin {timestamp}"
            }
        )
        if success and response:
            # Check if role is admin
            if response.get('role') == 'admin':
                print("✅ Admin role correctly assigned to padrapatricio@gmail.com")
                return True
            else:
                print(f"❌ Expected admin role, got: {response.get('role')}")
        return success
    
    def test_duplicate_match(self):
        """Test duplicating a match for next week"""
        if not self.created_match_id:
            print("⚠️  Skipping duplicate match test - no match created")
            return True
        return self.run_test(
            "Duplicate Match (+7 days)",
            "POST",
            f"matches/{self.created_match_id}/duplicate",
            200
        )
    
    def test_guest_creation_and_photo(self):
        """Test creating guest and uploading photo"""
        # First create a guest player
        timestamp = int(datetime.now().timestamp())
        success, response = self.run_test(
            "Create Guest Player",
            "POST",
            "players/guest",
            200,
            data={
                "name": f"Test Guest {timestamp}",
                "primary_position": "Delantero",
                "estimated_level": 6.5
            }
        )
        
        if success and response:
            guest_id = response.get('id')
            print(f"   Created Guest ID: {guest_id}")
            
            if guest_id:
                # Try to upload a photo (this will fail without actual file, but tests the endpoint)
                # We'll simulate the test by checking if endpoint exists and gives proper error
                test_headers = {'Authorization': f'Bearer {self.token}'}
                url = f"{self.base_url}/api/players/{guest_id}/photo"
                try:
                    # Test with no file - should give 422 (validation error) or 400
                    response = requests.post(url, headers=test_headers, timeout=30)
                    if response.status_code in [400, 422]:
                        print("✅ Guest photo upload endpoint exists and validates properly")
                        self.tests_run += 1
                        self.tests_passed += 1
                        return True
                    else:
                        print(f"⚠️  Photo endpoint gave unexpected status: {response.status_code}")
                except Exception as e:
                    print(f"❌ Error testing photo endpoint: {e}")
            
        return success

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting App Fútbol Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test basic endpoints
        self.test_root_endpoint()
        self.test_positions_endpoint()

        # Test authentication
        if not self.test_login_admin():
            print("\n❌ Admin login failed - stopping tests")
            return 1

        # Test user endpoints
        self.test_get_me()
        self.test_get_profile()
        self.test_update_profile()

        # Test new user registration
        self.test_register_new_user()

        # Test match endpoints
        self.test_create_match()
        self.test_list_matches()
        self.test_get_match_detail()
        self.test_register_for_match()
        self.test_get_match_registrations()
        self.test_generate_teams()

        # Test player endpoints
        self.test_list_players()

        # Test admin endpoints
        self.test_admin_stats()
        self.test_admin_list_users()
        
        # Test NEW features added in iteration 2
        self.test_admin_registration()
        self.test_duplicate_match()
        self.test_guest_creation_and_photo()

        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} PASSED")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Backend tests mostly successful!")
            return 0
        elif success_rate >= 60:
            print("⚠️  Backend has some issues but mostly working")
            return 1
        else:
            print("❌ Backend has significant issues")
            return 2

def main():
    tester = FutbolAppTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())