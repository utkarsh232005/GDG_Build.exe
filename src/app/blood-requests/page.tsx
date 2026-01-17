'use client';

import { useState, useEffect } from 'react';
import { Bell, Droplet, Heart, Users, LayoutDashboard, User, Settings, LogOut, UserCircle, MapPin, Calendar, Clock, Filter, Search, ChevronDown, AlertCircle, Info, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { bloodRequestAPI } from '@/lib/api';
import { collection, addDoc, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

interface BloodRequest {
  id: string;
  bloodType: string;
  urgency: 'critical' | 'high' | 'medium' | 'standard';
  hospital: string;
  location: string;
  requiredBy: string;
  postedOn: string;
  distance: string;
  units: number;
  createdAt?: any;
}

export default function BloodRequestsPage() {
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'nearby'
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch blood requests from Firebase
  const fetchBloodRequests = async () => {
    setLoading(true);
    try {
      console.log('Fetching blood requests from Firebase...');

      // Try with orderBy first, fallback to simple query if index doesn't exist
      let requestsSnapshot;
      try {
        requestsSnapshot = await getDocs(
          query(collection(db, 'blood_requests'), orderBy('createdAt', 'desc'))
        );
      } catch (indexError: any) {
        console.warn('OrderBy query failed (may need index), trying simple query...', indexError);
        // If orderBy fails (usually due to missing index), try without ordering
        requestsSnapshot = await getDocs(collection(db, 'blood_requests'));
      }

      console.log(`Found ${requestsSnapshot.docs.length} blood requests`);

      const requests: BloodRequest[] = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Document data:', doc.id, data);
        return {
          id: doc.id,
          bloodType: data.bloodType || '',
          urgency: data.urgency || 'standard',
          hospital: data.hospital || '',
          location: data.location || '',
          requiredBy: data.requiredBy || '',
          postedOn: data.postedOn || formatTimeAgo(data.createdAt?.toDate()),
          distance: data.distance || 'Unknown',
          units: data.units || 1,
          createdAt: data.createdAt
        };
      });

      // Sort by urgency locally if we couldn't use orderBy
      requests.sort((a, b) => {
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, standard: 3 };
        return (urgencyOrder[a.urgency] || 4) - (urgencyOrder[b.urgency] || 4);
      });

      setBloodRequests(requests);
      if (requests.length > 0) {
        toast.success(`Loaded ${requests.length} blood requests`);
      }
    } catch (error: any) {
      console.error('Error fetching blood requests:', error);
      console.error('Error details:', error.message, error.code);
      toast.error(`Failed to load: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Format time ago helper
  const formatTimeAgo = (date: Date | undefined) => {
    if (!date) return 'Just now';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchBloodRequests();
  }, []);

  // Filter blood requests based on selected filters and search query
  const filteredRequests = bloodRequests.filter(request => {
    // Apply blood type filter
    if (bloodTypeFilter !== 'all' && request.bloodType !== bloodTypeFilter) {
      return false;
    }

    // Apply urgency filter
    if (urgencyFilter !== 'all' && request.urgency !== urgencyFilter) {
      return false;
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        request.hospital.toLowerCase().includes(query) ||
        request.location.toLowerCase().includes(query) ||
        request.bloodType.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort by urgency and distance if in nearby mode
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, standard: 3 };

    // First sort by urgency
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // If in nearby mode, also sort by distance
    if (viewMode === 'nearby') {
      return parseFloat(a.distance) - parseFloat(b.distance);
    }

    return 0;
  });

  const renderUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-600 font-semibold">Critical</span>;
      case 'high':
        return <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-600 font-semibold">High</span>;
      case 'medium':
        return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-600 font-semibold">Medium</span>;
      case 'standard':
        return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600 font-semibold">Standard</span>;
      default:
        return null;
    }
  };

  const handleResponseClick = (request: BloodRequest) => {
    alert(`You are responding to a request for ${request.bloodType} blood type at ${request.hospital}. Thank you for your help!`);
  };

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 shrink-0 text-[#DC2626]" />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <User className="h-5 w-5 shrink-0 text-[#DC2626]" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5 shrink-0 text-[#DC2626]" />,
    },
    {
      label: "Blood Requests",
      href: "/blood-requests",
      icon: <Droplet className="h-5 w-5 shrink-0 text-[#DC2626]" />,
    },
    {
      label: "Logout",
      href: "/",
      icon: <LogOut className="h-5 w-5 shrink-0 text-[#DC2626]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#2C3E50]">
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {open ? <Logo /> : <LogoIcon />}
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
            <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[#2C3E50]">
                  Blood <span className="text-[#DC2626]">Requests</span>
                </h2>
                <p className="mt-2 text-[#7F8C8D]">Find and respond to blood donation requests in your area</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={fetchBloodRequests}
                  disabled={loading}
                  className="flex items-center px-3 py-2 bg-white border border-[#E1E8ED] rounded-md text-[#2C3E50] hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Emergency Alert */}
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-600">Emergency Blood Shortage</h3>
                <p className="text-sm text-red-700">There is a critical shortage of O- blood type in your area. If you are eligible to donate, please consider responding to these requests urgently.</p>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
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
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  <Droplet className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#DC2626]" />
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#7F8C8D]" />
                </div>

                {/* Urgency Filter */}
                <div className="relative">
                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="appearance-none pl-8 pr-10 py-2 bg-white border border-[#E1E8ED] rounded-md text-[#2C3E50] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                  >
                    <option value="all">All Urgency Levels</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="standard">Standard</option>
                  </select>
                  <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#DC2626]" />
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#7F8C8D]" />
                </div>

                {/* View Toggle */}
                <div className="flex rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('all')}
                    className={`px-4 py-2 text-sm font-medium ${viewMode === 'all' ?
                      'bg-[#DC2626] text-white' :
                      'bg-white text-[#2C3E50] border border-[#E1E8ED] hover:bg-[#F8FAFC]'}`}
                  >
                    All Requests
                  </button>
                  <button
                    onClick={() => setViewMode('nearby')}
                    className={`px-4 py-2 text-sm font-medium ${viewMode === 'nearby' ?
                      'bg-[#DC2626] text-white' :
                      'bg-white text-[#2C3E50] border border-[#E1E8ED] hover:bg-[#F8FAFC]'}`}
                  >
                    Nearby First
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search hospital or location"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 pl-10 pr-4 py-2 bg-white border border-[#E1E8ED] rounded-md text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#7F8C8D]" />
              </div>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
              {loading ? (
                <div className="p-8 text-center bg-white border border-[#E1E8ED] rounded-lg">
                  <div className="h-8 w-8 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-[#2C3E50]">Loading blood requests...</h3>
                  <p className="text-[#7F8C8D] mt-1">Fetching data from Firebase</p>
                </div>
              ) : sortedRequests.length > 0 ? (
                sortedRequests.map((request) => (
                  <div key={request.id} className="bg-white border border-[#E1E8ED] rounded-lg p-4 shadow-sm">
                    <div className="flex flex-wrap gap-4 items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-[#DC2626]">{request.bloodType}</span>
                          {renderUrgencyBadge(request.urgency)}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-[#2C3E50]">{request.hospital}</h3>
                        <div className="mt-1 flex items-center text-[#7F8C8D]">
                          <MapPin className="h-4 w-4 mr-1 text-[#7F8C8D]" />
                          <span className="text-sm">{request.location} • {request.distance}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <button
                          onClick={() => handleResponseClick(request)}
                          className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md flex items-center"
                        >
                          <Heart className="h-4 w-4 mr-2" />
                          Respond
                        </button>
                        <div className="mt-2 text-sm text-[#7F8C8D]">
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>{request.units} units needed</span>
                          </span>
                          <span className="flex items-center mt-1">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Required by: {request.requiredBy}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#E1E8ED] flex justify-between items-center">
                      <span className="text-xs text-[#7F8C8D]">Posted {request.postedOn}</span>
                      <button className="text-xs text-[#DC2626] hover:underline flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        More Details
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white border border-[#E1E8ED] rounded-lg">
                  <Database className="h-12 w-12 mx-auto text-[#7F8C8D] mb-3" />
                  <h3 className="text-lg font-semibold text-[#2C3E50]">No blood requests found</h3>
                  <p className="text-[#7F8C8D] mt-1">
                    {bloodTypeFilter !== 'all' || urgencyFilter !== 'all' || searchQuery
                      ? 'Try adjusting your filters or search criteria'
                      : 'Click "Seed Dummy Data" to add sample blood requests to Firebase'}
                  </p>
                  {bloodTypeFilter === 'all' && urgencyFilter === 'all' && !searchQuery && (
                    <button
                      onClick={seedDummyData}
                      disabled={seeding}
                      className="mt-4 px-4 py-2 bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                    >
                      {seeding ? 'Seeding...' : 'Seed Dummy Data'}
                    </button>
                  )}
                </div>
              )}
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

const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center justify-center py-1"
    >
      <div className="h-6 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#DC2626] flex items-center justify-center">
        <Droplet className="h-4 w-4 text-white" fill="currentColor" />
      </div>
    </Link>
  );
}; 
