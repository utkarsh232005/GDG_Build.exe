'use client';

import { useState, useEffect, useCallback } from 'react';
import { Droplet, MapPin, Phone, Clock, Navigation, Star, Search, Filter, LayoutDashboard, User, Settings, LogOut, UserCircle, Heart, Users, Map, Locate, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast, Toaster } from 'react-hot-toast';

// Dynamically import GoogleMap to avoid SSR issues
const GoogleMapComponent = dynamic(() => import('@/components/GoogleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <div className="text-center">
        <div className="h-10 w-10 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

interface BloodBank {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  distance: string;
  rating: number;
  bloodTypes: string[];
  position: { lat: number; lng: number };
  isOpen?: boolean;
}

const libraries: ("places")[] = ["places"];

export default function BloodBanksPage() {
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BloodBank | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [mapType, setMapType] = useState('roadmap');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Default to Delhi
  const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{ title: string, message: string } | null>(null);

  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
  };

  // Mock data for fallback
  const mockBloodBanks: BloodBank[] = [
    {
      id: 'mock-1',
      name: 'City Red Cross Blood Center',
      address: '123 Healthcare Blvd, Downtown',
      phone: '(555) 123-4567',
      hours: 'Open Now',
      distance: '1.2 km',
      rating: 4.5,
      bloodTypes: ['A+', 'O+', 'B-'],
      position: { lat: 28.6139, lng: 77.2090 }, // Near Delhi
      isOpen: true,
    },
    {
      id: 'mock-2',
      name: 'LifeSaver Donation Clinic',
      address: '45 Medical Park Dr, Westside',
      phone: '(555) 987-6543',
      hours: 'Closes at 5 PM',
      distance: '3.5 km',
      rating: 4.8,
      bloodTypes: ['AB+', 'O-', 'A+'],
      position: { lat: 28.6239, lng: 77.2190 },
      isOpen: true,
    },
    {
      id: 'mock-3',
      name: 'Community Hospital Blood Bank',
      address: '789 Community Rd, North Hills',
      phone: '(555) 555-5555',
      hours: '24 Hours',
      distance: '5.1 km',
      rating: 4.2,
      bloodTypes: ['All types'],
      position: { lat: 28.6039, lng: 77.1990 },
      isOpen: true,
    }
  ];

  // Fetch nearby blood banks using Google Places API
  const fetchNearbyBloodBanks = useCallback(async (location: { lat: number; lng: number }, radius: number = 10000) => {
    if (!isLoaded || !window.google) {
      console.log('Google Maps not loaded yet');
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      const service = new google.maps.places.PlacesService(document.createElement('div'));

      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        keyword: 'blood bank', // Simplified keyword for better results
        type: 'health' as any, // Broader type
      };

      console.log(`Searching for blood banks with radius: ${radius}m`);

      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          console.log(`Found ${results.length} blood banks`);
          const banks: BloodBank[] = results.map((place, index) => {
            const placeLocation = place.geometry?.location;
            const lat = placeLocation?.lat() || location.lat;
            const lng = placeLocation?.lng() || location.lng;

            // Randomly assign blood types (in a real app, this would come from a backend)
            const allBloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
            const randomBloodTypes = allBloodTypes.filter(() => Math.random() > 0.3);

            return {
              id: place.place_id || `bank-${index}`,
              name: place.name || 'Unknown Blood Bank',
              address: place.vicinity || 'Address not available',
              phone: '', // Detailed info would need getDetails
              hours: place.opening_hours?.isOpen?.() ? 'Open Now' : 'Hours not available',
              distance: calculateDistance(location.lat, location.lng, lat, lng),
              rating: place.rating || 0,
              bloodTypes: randomBloodTypes.length > 0 ? randomBloodTypes : ['A+', 'O+'],
              position: { lat, lng },
              isOpen: place.opening_hours?.isOpen?.(),
            };
          });

          // Sort by distance
          banks.sort((a, b) => {
            const distA = parseFloat(a.distance);
            const distB = parseFloat(b.distance);
            return distA - distB;
          });

          setBloodBanks(banks);
          setIsLoading(false);
        } else {
          console.log('Places API returned status:', status);

          // Retry with larger radius if no results and radius is small
          if ((status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS || (results && results.length === 0)) && radius < 50000) {
            console.log("No results found nearby, expanding search to city-wide (50km)...");
            fetchNearbyBloodBanks(location, 50000); // Retry with 50km
            return;
          }

          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            toast.error('No blood banks found even in the wider area.');
            setBloodBanks([]);
          } else if (status === 'REQUEST_DENIED') {
            setApiError({
              title: 'API Configuration Error',
              message: 'Google Maps API key is invalid or unauthorized. Please check that "Places API" is enabled in Google Cloud Console and billing is active.'
            });
            toast.error('Google Maps API Error: Request Denied');
          } else {
            const errorMsg = `Maps API Error: ${status}`;
            toast.error(errorMsg);
            setApiError({
              title: 'Search Failed',
              message: `Google Maps returned status: ${status}. Please try again later.`
            });
          }
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Error fetching blood banks:', error);
      toast.error('Failed to connect to Maps API.');
      setApiError({
        title: 'Connection Error',
        message: 'Could not connect to Google Maps API. Please check your internet connection.'
      });
      setIsLoading(false);
    }
  }, [isLoaded]);

  // Get user's location
  const getUserLocation = useCallback(() => {
    setLocationError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          setMapCenter(location);
          fetchNearbyBloodBanks(location);
        },
        (error) => {
          console.log('Geolocation error:', error);
          setLocationError('Unable to get your location. Using default location.');
          // Use default location
          fetchNearbyBloodBanks(mapCenter);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
      fetchNearbyBloodBanks(mapCenter);
    }
  }, [fetchNearbyBloodBanks, mapCenter]);

  // Initial load
  useEffect(() => {
    if (isLoaded) {
      getUserLocation();
    }
  }, [isLoaded]);

  const links = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
    { label: "Profile", href: "/profile", icon: <User className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
    { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
    { label: "Blood Requests", href: "/blood-requests", icon: <Droplet className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
    { label: "Blood Banks", href: "/blood-banks", icon: <MapPin className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
    { label: "Logout", href: "/", icon: <LogOut className="h-5 w-5 shrink-0 text-[#DC2626]" /> },
  ];

  // Filter blood banks
  const filteredBanks = bloodBanks.filter((bank) => {
    const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bank.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBloodType = bloodTypeFilter === 'all' || bank.bloodTypes.includes(bloodTypeFilter);
    return matchesSearch && matchesBloodType;
  });

  const handleGetDirections = (bank: BloodBank) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${bank.position.lat},${bank.position.lng}`;
    window.open(url, '_blank');
  };

  const handleRefresh = () => {
    if (userLocation) {
      fetchNearbyBloodBanks(userLocation);
    } else {
      getUserLocation();
    }
  };

  const mapTypes = [
    { id: 'roadmap', label: 'Road', icon: '🗺️' },
    { id: 'satellite', label: 'Satellite', icon: '🛰️' },
    { id: 'terrain', label: 'Terrain', icon: '⛰️' },
    { id: 'hybrid', label: 'Hybrid', icon: '🌍' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#2C3E50]">
      <Toaster position="top-right" />
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <Logo />
              <div className="mt-8 flex flex-col gap-1">
                {links.map((link, idx) => (
                  <SidebarLink key={idx} link={link} />
                ))}
              </div>
            </div>
            <div>
              <SidebarLink
                link={{
                  label: userData?.firstName && userData?.lastName
                    ? `${userData.firstName} ${userData.lastName}`
                    : user?.email?.split('@')[0] || "User",
                  href: "/profile",
                  icon: (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-[#DC2626]/30 flex items-center justify-center">
                      <UserCircle className="h-5 w-5 text-[#DC2626]" />
                    </div>
                  ),
                }}
              />
            </div>
          </SidebarBody>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[#2C3E50]">
                  Nearby <span className="text-[#DC2626]">Blood Banks</span>
                </h2>
                <p className="mt-2 text-[#7F8C8D]">
                  {userLocation
                    ? `Showing blood banks near your location`
                    : 'Getting your location...'}
                </p>
                {locationError && (
                  <p className="text-sm text-orange-600 mt-1">{locationError}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={getUserLocation}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Locate className="h-4 w-4 mr-2" />
                  My Location
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center px-3 py-2 bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                >
                  <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search blood banks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E1E8ED] rounded-md text-[#2C3E50] placeholder-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#7F8C8D]" />
              </div>

              {/* Blood Type Filter */}
              <div className="relative">
                <select
                  value={bloodTypeFilter}
                  onChange={(e) => setBloodTypeFilter(e.target.value)}
                  className="appearance-none pl-8 pr-10 py-2 bg-white border border-[#E1E8ED] rounded-md text-[#2C3E50] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                >
                  <option value="all">All Blood Types</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
                <Droplet className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#DC2626]" />
                <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#7F8C8D]" />
              </div>

              {/* Map Type Selector */}
              <div className="flex rounded-lg overflow-hidden border border-[#E1E8ED]">
                {mapTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setMapType(type.id)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${mapType === type.id
                      ? 'bg-[#DC2626] text-white'
                      : 'bg-white text-[#2C3E50] hover:bg-gray-50'
                      }`}
                    title={type.label}
                  >
                    <span className="mr-1">{type.icon}</span>
                    <span className="hidden sm:inline">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Map and List Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Map */}
              <div className="h-[500px] lg:h-[600px] rounded-xl overflow-hidden shadow-lg border border-[#E1E8ED]">
                {GOOGLE_MAPS_API_KEY ? (
                  <GoogleMapComponent
                    bloodBanks={filteredBanks}
                    selectedBank={selectedBank}
                    onSelectBank={setSelectedBank}
                    center={mapCenter}
                    userLocation={userLocation}
                    apiKey={GOOGLE_MAPS_API_KEY}
                    mapType={mapType}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <div className="text-center p-8">
                      <MapPin className="h-16 w-16 text-[#DC2626] mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">Map Preview</h3>
                      <p className="text-[#7F8C8D] text-sm max-w-xs mx-auto">
                        Add your Google Maps API key to <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your .env.local file.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Blood Banks List */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {isLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center bg-white rounded-lg border border-[#E1E8ED]">
                    <div className="h-10 w-10 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#7F8C8D]">Finding nearby blood banks...</p>
                  </div>
                ) : apiError ? (
                  <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2 text-red-700 font-semibold">
                      <MapPin className="h-5 w-5" />
                      <h3>{apiError.title}</h3>
                    </div>
                    <p className="text-sm text-red-600 mb-4">
                      {apiError.message}
                    </p>
                    <button
                      onClick={handleRefresh}
                      className="text-sm bg-white border border-red-300 text-red-700 px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
                    >
                      Retry Search
                    </button>
                  </div>
                ) : filteredBanks.length > 0 ? (
                  filteredBanks.map((bank) => (
                    <div
                      key={bank.id}
                      onClick={() => setSelectedBank(bank)}
                      className={`p-5 rounded-lg bg-white border transition-all cursor-pointer hover:shadow-md ${selectedBank?.id === bank.id
                        ? 'border-[#DC2626] shadow-md ring-1 ring-[#DC2626]/20'
                        : 'border-[#E1E8ED] hover:border-[#DC2626]/50'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[#2C3E50]">{bank.name}</h3>
                          <div className="flex items-center mt-1 text-sm text-[#7F8C8D]">
                            {bank.rating > 0 && (
                              <>
                                <Star className="h-4 w-4 text-yellow-500 mr-1" fill="currentColor" />
                                <span>{bank.rating.toFixed(1)}</span>
                                <span className="mx-2">•</span>
                              </>
                            )}
                            <Navigation className="h-4 w-4 mr-1" />
                            <span>{bank.distance}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${bank.isOpen
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                          }`}>
                          {bank.isOpen ? 'Open Now' : bank.hours}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-[#7F8C8D]">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-[#DC2626]" />
                          <span>{bank.address}</span>
                        </div>
                        {bank.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-[#DC2626]" />
                            <span>{bank.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Available Blood Types */}
                      <div className="mt-3 pt-3 border-t border-[#E1E8ED]">
                        <p className="text-xs text-[#7F8C8D] mb-2">Available Blood Types:</p>
                        <div className="flex flex-wrap gap-1">
                          {bank.bloodTypes.map((type) => (
                            <span
                              key={type}
                              className="px-2 py-1 bg-red-50 text-[#DC2626] text-xs font-medium rounded"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGetDirections(bank);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors"
                        >
                          <Navigation className="h-4 w-4" />
                          Get Directions
                        </button>
                        {bank.phone && (
                          <a
                            href={`tel:${bank.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center px-4 py-2 border border-[#DC2626] text-[#DC2626] rounded-md hover:bg-red-50 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white rounded-lg border border-[#E1E8ED]">
                    <MapPin className="h-12 w-12 mx-auto text-[#7F8C8D] mb-3" />
                    <h3 className="text-lg font-semibold text-[#2C3E50]">No blood banks found</h3>
                    <p className="text-[#7F8C8D] mt-1">
                      {searchQuery || bloodTypeFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'No blood banks found in your area'}
                    </p>
                    <button
                      onClick={handleRefresh}
                      className="mt-4 px-4 py-2 bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors"
                    >
                      Retry Search
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-lg bg-white border border-[#E1E8ED]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Heart className="h-6 w-6 text-[#DC2626]" />
                  </div>
                  <h3 className="font-semibold text-[#2C3E50]">Donate Blood</h3>
                </div>
                <p className="text-sm text-[#7F8C8D]">
                  One donation can save up to 3 lives. Find a nearby blood bank and schedule your donation today.
                </p>
              </div>

              <div className="p-5 rounded-lg bg-white border border-[#E1E8ED]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-[#2C3E50]">Eligibility</h3>
                </div>
                <p className="text-sm text-[#7F8C8D]">
                  Most healthy adults aged 18-65 can donate. Check with your local blood bank for specific requirements.
                </p>
              </div>

              <div className="p-5 rounded-lg bg-white border border-[#E1E8ED]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-[#2C3E50]">Quick Process</h3>
                </div>
                <p className="text-sm text-[#7F8C8D]">
                  The donation process takes about 10-15 minutes. The entire visit typically lasts under an hour.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-[#2C3E50]"
    >
      <div className="h-6 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#DC2626] flex items-center justify-center">
        <Droplet className="h-4 w-4 text-white" fill="currentColor" />
      </div>
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="font-semibold text-base whitespace-pre text-[#2C3E50]"
      >
        BloodConnect
      </motion.span>
    </Link>
  );
};
