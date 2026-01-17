'use client';

import { Bell, Droplet, Heart, Users, LayoutDashboard, User, Settings, LogOut, UserCircle, Calendar, AlertCircle, Clock, Phone, Mail, Info, Plus, Edit, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import DonationScheduleModal, { DonationFormData } from '@/components/DonationScheduleModal';
import UserTypeSelector from '@/components/UserTypeSelector';
import DonationListingForm, { DonationListingData } from '@/components/DonationListingForm';
import DonationsList from '@/components/DonationsList';
import { donationAPI, userAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast, Toaster } from 'react-hot-toast';

export default function Dashboard() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [userType, setUserType] = useState<'donor' | 'recipient'>(
    user?.role?.toLowerCase() === 'recipient' ? 'recipient' : 'donor'
  );
  const [donations, setDonations] = useState<DonationListingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'emergency', message: 'Urgent need for O- blood type in City Hospital', time: '10 min ago' },
    { id: 2, type: 'appointment', message: 'Your donation appointment is confirmed', time: '1 hour ago' },
    { id: 3, type: 'update', message: 'Blood inventory update: A+ type is low', time: '3 hours ago' }
  ]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [processedDonationIds, setProcessedDonationIds] = useState<Set<string>>(new Set());

  // Update userType when user changes
  useEffect(() => {
    if (user?.role) {
      const newUserType = user.role.toLowerCase() as 'donor' | 'recipient';

      // Only update if it actually changed to avoid refresh loops
      if (newUserType !== userType) {
        console.log(`User role changed from ${userType} to ${newUserType}, updating...`);
        setUserType(newUserType);
      }
    }
  }, [user, userType]);

  // Load donations from backend API
  useEffect(() => {
    const fetchDonations = async () => {
      if (!user) {
        console.log("No user logged in, skipping donation fetch");
        setDonations([]);
        setIsLoading(false);
        return;
      }

      console.log("Starting donation fetch process with user:", user.uid);
      setIsLoading(true);
      setLoadError(null);

      try {
        console.log(`Fetching donations as ${userType}...`);
        let donationData: any[] = [];

        if (userType === 'donor') {
          // Fetch donor's own donations (including any pending ones)
          console.log("Fetching donor's donations from Firestore with UID:", user.uid);
          donationData = await donationAPI.getMyDonations();
          console.log("Raw donor donations received:", donationData);
        } else {
          // Fetch available donations for recipients
          console.log("Fetching available donations for recipient");
          donationData = await donationAPI.getAvailableDonations();
          console.log("Raw available donations received:", donationData);
        }

        if (!donationData) {
          console.error("No donation data returned from API");
          donationData = [];
        } else if (!Array.isArray(donationData)) {
          console.error("Invalid donation data format (not an array):", donationData);
          donationData = [];
        }

        console.log("Processing donation data of length:", donationData.length);

        // Transform API data to match our frontend model with better error handling
        const transformedDonations = donationData
          .filter(donation => donation !== null && donation !== undefined)
          .map((donation: any) => {
            try {
              // Convert 'pending' or 'requested' status consistently
              let status = (donation.status || 'available').toLowerCase();
              // Ensure we normalize 'requested' to 'pending' for consistency
              if (status === 'requested') status = 'pending';

              return {
                id: `donation-${donation.id || 'unknown'}`,
                donorName: donation.donorName || 'Anonymous',
                bloodType: donation.bloodType || 'Unknown',
                contactNumber: donation.contactNumber || 'N/A',
                availability: donation.availability || 'N/A',
                location: donation.location || 'N/A',
                additionalInfo: donation.additionalInfo || '',
                listedOn: donation.listedOn ? new Date(donation.listedOn).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Unknown date',
                status: status,
                requesterId: donation.recipientId || '',
                recipientName: donation.recipientName || ''
              };
            } catch (err) {
              console.error("Error transforming donation:", err, donation);
              return null;
            }
          })
          .filter((item): item is typeof item => item !== null) as DonationListingData[];

        console.log("Processed transformed donations:", transformedDonations);
        setDonations(transformedDonations);
      } catch (error: any) {
        console.error('Error fetching donations:', error);
        const errorMessage = error.message || "Failed to load donations";
        setLoadError(errorMessage);
        toast.error(`Error: ${errorMessage}`);
        // Set empty array instead of keeping old state to avoid stale data
        setDonations([]);
      } finally {
        setIsLoading(false);
      }
    };

    console.log("Donation fetch useEffect triggered - user:", user?.uid, "userType:", userType);
    fetchDonations();
  }, [user, userType]);

  interface Appointment {
    id: number;
    date: string;
    time: string;
    location: string;
    status: 'confirmed' | 'pending';
  }

  // Load appointments from localStorage if available
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const savedAppointments = localStorage.getItem('bloodconnect_appointments');
    if (savedAppointments) {
      setAppointments(JSON.parse(savedAppointments));
    }
  }, []);

  // Save appointments to localStorage when they change
  useEffect(() => {
    localStorage.setItem('bloodconnect_appointments', JSON.stringify(appointments));
  }, [appointments]);

  // Fetch notifications when component mounts
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        console.log("Fetching notifications for user:", user.uid);
        const notificationData = await donationAPI.getNotifications();

        // Only update state if we have valid data
        if (Array.isArray(notificationData)) {
          setUserNotifications(notificationData);

          // Check if there are unread notifications
          const unreadCount = notificationData.filter(notification => {
            if (!notification) return false;
            return typeof notification === 'object' && 'read' in notification && !notification.read;
          }).length;

          if (unreadCount > 0) {
            console.log(`User has ${unreadCount} unread notifications`);
          }
        }
      } catch (error: any) {
        console.error('Error fetching notifications:', error);

        // Handle index errors gracefully
        if (error.message && error.message.includes('requires an index')) {
          toast.error(
            'We\'re setting up notifications. Please try again in a few minutes.',
            { duration: 4000 }
          );
        }
      }
    };

    // Only fetch if user is logged in
    if (user?.uid) {
      fetchNotifications();
    }
  }, [user]);

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

  const handleScheduleDonation = () => {
    setAppointmentToReschedule(null);
    setShowDonationModal(true);
  };

  const handleUpdateProfile = () => {
    router.push('/profile');
  };

  const handleViewBloodRequests = () => {
    router.push('/blood-requests');
  };

  const handleDonateNow = () => {
    setAppointmentToReschedule(null);
    setShowDonationModal(true);
  };

  const handleRescheduleAppointment = (appointment?: Appointment) => {
    if (appointment) {
      setAppointmentToReschedule(appointment);
      setShowDonationModal(true);
    } else if (appointments.length > 0) {
      setAppointmentToReschedule(appointments[0]);
      setShowDonationModal(true);
    } else {
      alert('No appointments to reschedule. Please schedule a donation first.');
    }
  };

  const handleViewBloodBanks = () => {
    router.push('/blood-banks');
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to clear all donation data? This action cannot be undone.')) {
      localStorage.removeItem('bloodconnect_donations');
      localStorage.removeItem('bloodconnect_appointments');
      setDonations([]);
      setAppointments([]);
      alert('All donation data has been cleared.');
    }
  };

  const handleDonationSubmit = (data: DonationFormData) => {
    console.log('Donation scheduled:', data);

    const formattedDate = new Date(data.date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    if (appointmentToReschedule) {
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointmentToReschedule.id
            ? {
              ...apt,
              date: formattedDate,
              time: data.time,
              location: data.location
            }
            : apt
        )
      );
      alert(`Appointment rescheduled!\nDate: ${formattedDate}\nTime: ${data.time}\nLocation: ${data.location}`);
    } else {
      const newAppointment: Appointment = {
        id: Date.now(),
        date: formattedDate,
        time: data.time,
        location: data.location,
        status: 'pending'
      };

      setAppointments(prev => [...prev, newAppointment]);
      alert(`Donation scheduled!\nDate: ${formattedDate}\nTime: ${data.time}\nLocation: ${data.location}`);
    }

    setAppointmentToReschedule(null);
  };

  const handleListDonation = () => {
    setShowListingModal(true);
  };

  const deduplicateDonations = (donationsList: DonationListingData[]): DonationListingData[] => {
    const uniqueDonations: DonationListingData[] = [];
    const seenIds = new Set<string>();

    for (const donation of donationsList) {
      if (!seenIds.has(donation.id)) {
        seenIds.add(donation.id);
        uniqueDonations.push(donation);
      } else {
        console.log(`Skipping duplicate donation with ID: ${donation.id}`);
      }
    }

    return uniqueDonations;
  };

  const handleListingSubmit = async (donationData: DonationListingData) => {
    // First close the modal to prevent multiple submissions
    setShowListingModal(false);

    const toastId = toast.loading('Creating new donation listing...');

    try {
      // Call the API to create the donation
      await donationAPI.createDonation({
        bloodType: donationData.bloodType,
        contactNumber: donationData.contactNumber,
        availability: donationData.availability,
        location: donationData.location,
        additionalInfo: donationData.additionalInfo,
        status: 'available'
      });

      // Update toast to success
      toast.success('Donation listed successfully!', { id: toastId });

      // Wait before refreshing to ensure database consistency
      setTimeout(() => {
        refreshUserDataAndDonations();
      }, 1000);
    } catch (error: any) {
      console.error('Error saving donation:', error);

      // Handle index errors gracefully
      if (error.message && error.message.includes('requires an index')) {
        toast.error(
          'Your donation was saved, but we\'re setting up the database. Please wait a moment and refresh.',
          { id: toastId, duration: 5000 }
        );

        // Try refreshing after a delay to see if indexes are ready
        setTimeout(() => refreshUserDataAndDonations(), 5000);
      } else {
        toast.error('Failed to save donation data', { id: toastId });
      }
    }
  };

  const handleDonationStatusChange = async (donationId: string, newStatus: 'available' | 'pending' | 'completed') => {
    try {
      const id = donationId.split('-')[1];

      toast.loading('Updating donation status...', { id: 'status-toast' });

      if (newStatus === 'completed') {
        await donationAPI.confirmDonation(id);
      } else if (newStatus === 'available' && userType === 'recipient') {
        await donationAPI.cancelRequest(id);
      }

      setTimeout(() => {
        refreshUserDataAndDonations();
        toast.success('Status updated successfully', { id: 'status-toast' });
      }, 1000);

    } catch (error) {
      console.error('Error updating donation status:', error);
      toast.error('Failed to update status', { id: 'status-toast' });
    }
  };

  const handleRequestDonation = async (donationId: string) => {
    try {
      const id = donationId.split('-')[1];

      toast.loading('Requesting donation...', { id: 'request-toast' });
      await donationAPI.requestDonation(id);

      setTimeout(() => {
        refreshUserDataAndDonations();
        toast.success('Request sent successfully', { id: 'request-toast' });
      }, 1000);

    } catch (error) {
      console.error('Error requesting donation:', error);
      toast.error('Failed to request donation', { id: 'request-toast' });
    }
  };

  const handleAcceptDonationRequest = async (donationId: string, recipientId: string) => {
    try {
      const id = donationId.split('-')[1];

      toast.loading('Accepting request...', { id: 'accept-toast' });
      await donationAPI.acceptDonationRequest(id, recipientId);

      setTimeout(() => {
        refreshUserDataAndDonations();
        toast.success('Request accepted successfully', { id: 'accept-toast' });
      }, 1000);

    } catch (error) {
      console.error('Error accepting donation request:', error);
      toast.error('Failed to accept request', { id: 'accept-toast' });
    }
  };

  const handleRejectDonationRequest = async (donationId: string, recipientId: string) => {
    try {
      const id = donationId.split('-')[1];

      toast.loading('Rejecting request...', { id: 'reject-toast' });
      await donationAPI.rejectDonationRequest(id, recipientId);

      setTimeout(() => {
        refreshUserDataAndDonations();
        toast.success('Request rejected successfully', { id: 'reject-toast' });
      }, 1000);

    } catch (error) {
      console.error('Error rejecting donation request:', error);
      toast.error('Failed to reject request', { id: 'reject-toast' });
    }
  };

  const refreshUserDataAndDonations = async () => {
    if (!user) {
      console.log("Cannot refresh - no user logged in");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Refreshing data...');

    try {
      // First refresh user data from Firestore
      console.log("Fetching latest user profile...");
      const userData = await userAPI.getProfile();

      // Make sure the userType state is updated based on the latest user role
      if (userData && typeof userData === 'object' && 'role' in userData) {
        const newRole = (userData.role as string).toLowerCase() as 'donor' | 'recipient';
        if (newRole !== userType) {
          setUserType(newRole);
        }
      }

      // Then reload the donations based on current user type
      let donationData: any[] = [];

      try {
        if (userType === 'donor') {
          donationData = await donationAPI.getMyDonations();
        } else {
          donationData = await donationAPI.getAvailableDonations();
        }
      } catch (apiError) {
        console.error("API error fetching donations:", apiError);
        donationData = [];
      }

      if (!donationData || !Array.isArray(donationData)) {
        donationData = [];
      }

      // Transform and update the donations state with deduplication
      const transformedDonations = donationData
        .filter(donation => donation !== null && donation !== undefined)
        .map((donation: any) => {
          try {
            let status = (donation.status || 'available').toLowerCase();
            if (status === 'requested') status = 'pending';

            return {
              id: `donation-${donation.id || 'unknown'}`,
              donorName: donation.donorName || 'Anonymous',
              bloodType: donation.bloodType || 'Unknown',
              contactNumber: donation.contactNumber || 'N/A',
              availability: donation.availability || 'N/A',
              location: donation.location || 'N/A',
              additionalInfo: donation.additionalInfo || '',
              listedOn: donation.listedOn ? new Date(donation.listedOn).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Unknown date',
              status: status,
              requesterId: donation.recipientId || '',
              recipientName: donation.recipientName || ''
            };
          } catch (transformError) {
            console.error("Error transforming donation item:", transformError);
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Deduplicate the donations
      const uniqueDonations = deduplicateDonations(transformedDonations);
      console.log(`Filtered ${transformedDonations.length - uniqueDonations.length} duplicate donations`);

      setDonations(uniqueDonations);
      toast.success('Data refreshed successfully', { id: toastId });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data. Please try again.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;

    const handleRefreshEvent = () => {
      console.log("Donation data changed event received, scheduling refresh...");

      // Clear any existing timeout to debounce multiple rapid events
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      // Schedule a new refresh after a short delay
      refreshTimeout = setTimeout(() => {
        console.log("Executing debounced refresh");
        refreshUserDataAndDonations();
        refreshTimeout = null;
      }, 500);
    };

    window.addEventListener('donation-data-changed', handleRefreshEvent);

    return () => {
      window.removeEventListener('donation-data-changed', handleRefreshEvent);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [user, userType]);

  const retryLoadDonations = () => {
    toast.loading('Retrying donation load...');
    refreshUserDataAndDonations();
  };

  const userDonations = userType === 'donor'
    ? donations // Show all donations for donors, including pending ones
    : donations.filter(donation => donation.status === 'available'); // Only show available for recipients

  const donorStats = {
    totalDonations: donations.filter(d => d.status === 'completed').length,
    listedDonations: donations.filter(d => d.status === 'available').length
  };

  const recipientStats = {
    totalReceived: donations.filter(d => d.status === 'completed').length,
    availableDonors: donations.filter(d => d.status === 'available').length
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toaster position="top-right" />

      <div className="flex h-screen">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {open ? <Logo /> : <LogoIcon />}
              <div className="mt-8 flex flex-col gap-2">
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
                    <div className="h-7 w-7 shrink-0 rounded-full bg-[#DC2626]/20 flex items-center justify-center">
                      <UserCircle className="h-5 w-5 text-[#DC2626]" />
                    </div>
                  ),
                }}
              />
            </div>
          </SidebarBody>
        </Sidebar>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome to Your <span className="text-[#DC2626]">Dashboard</span>
              </h2>

              <div className="relative">
                <Bell className="h-6 w-6 text-[#DC2626] cursor-pointer" />
                <span className="absolute -top-1 -right-1 bg-[#DC2626] text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {notifications.length}
                </span>
              </div>
            </div>

            <UserTypeSelector userType={userType} setUserType={setUserType} />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                <div className="flex items-center space-x-3">
                  <Heart className="h-6 w-6 text-[#DC2626]" />
                  <div>
                    <p className="text-gray-600 text-sm">
                      {userType === 'donor' ? 'Total Donations' : 'Total Received'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {userType === 'donor'
                        ? donorStats.totalDonations
                        : recipientStats.totalReceived}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                <div className="flex items-center space-x-3">
                  <Users className="h-6 w-6 text-[#DC2626]" />
                  <div>
                    <p className="text-gray-600 text-sm">Lives Impacted</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {donorStats.totalDonations * 3 || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-6 w-6 text-[#DC2626]" />
                  <div>
                    <p className="text-gray-600 text-sm">Next Appointment</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {appointments.length > 0 ? appointments[0].date : "None"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-6 w-6 text-[#DC2626]" />
                  <div>
                    <p className="text-gray-600 text-sm">
                      {userType === 'donor'
                        ? 'Listed Donations'
                        : 'Available Donors'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {userType === 'donor'
                        ? donorStats.listedDonations
                        : recipientStats.availableDonors}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {userType === 'donor' ? 'Your Listed Donations' : 'Available Donations'}
                </h3>

                <div className="flex space-x-2">
                  <button
                    onClick={() => refreshUserDataAndDonations()}
                    className="bg-white hover:bg-gray-100 text-gray-900 border border-red-100 py-2 px-4 rounded-md transition-colors flex items-center"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    Refresh
                  </button>

                  {userType === 'donor' && (
                    <button
                      onClick={handleListDonation}
                      className="bg-[#DC2626] hover:bg-[#B91C1C] text-white py-2 px-4 rounded-md transition-colors flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      List Donation
                    </button>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center bg-white border border-red-100 rounded-lg">
                  <div className="h-12 w-12 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading donations...</p>
                </div>
              ) : loadError ? (
                <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-12 w-12 mx-auto text-red-600 mb-4" />
                  <h3 className="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h3>
                  <p className="text-red-600 mb-6">{loadError}</p>
                  <button
                    onClick={() => refreshUserDataAndDonations()}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-md transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : donations.length === 0 ? (
                <div className="p-8 text-center bg-white border border-red-100 rounded-lg">
                  <Heart className="h-12 w-12 mx-auto text-[#DC2626] mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No donations found</h3>
                  <p className="text-gray-600 mb-6">
                    {userType === 'donor'
                      ? 'You have not listed any donations yet. Click the "List Donation" button to get started.'
                      : 'There are no blood donations available at the moment. Please check back later.'}
                  </p>
                  <button
                    onClick={retryLoadDonations}
                    className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md transition-colors inline-flex items-center"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Retry Loading Donations
                  </button>
                </div>
              ) : (
                <DonationsList
                  donations={userDonations}
                  userType={userType}
                  onStatusChange={handleDonationStatusChange}
                  onRequestDonation={handleRequestDonation}
                  onAcceptRequest={handleAcceptDonationRequest}
                  onRejectRequest={handleRejectDonationRequest}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={userType === 'donor' ? handleScheduleDonation : handleRequestDonation.bind(null, donations.find(d => d.status === 'available')?.id || '')}
                      className="bg-[#DC2626] hover:bg-[#B91C1C] text-white py-3 px-4 rounded-md transition-colors flex items-center justify-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>{userType === 'donor' ? 'Schedule Donation' : 'Find Donors'}</span>
                    </button>
                    <button
                      onClick={handleUpdateProfile}
                      className="bg-transparent border border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10 py-3 px-4 rounded-md transition-colors flex items-center justify-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Update Profile</span>
                    </button>
                    <button
                      onClick={handleViewBloodRequests}
                      className="bg-transparent border border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10 py-3 px-4 rounded-md transition-colors flex items-center justify-center space-x-2">
                      <Droplet className="h-5 w-5" />
                      <span>View Blood Requests</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Appointments</h3>
                  <div className="space-y-4">
                    {appointments.length > 0 ? (
                      appointments.map((appointment) => (
                        <div key={appointment.id} className="flex items-start space-x-4 p-4 rounded-md bg-gray-50 border border-red-100">
                          <div className="flex-shrink-0 p-2 bg-[#DC2626]/10 rounded-md">
                            <Calendar className="h-5 w-5 text-[#DC2626]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">{appointment.date}</p>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{appointment.time}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{appointment.location}</p>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${appointment.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                              }`}>
                              {appointment.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </span>
                            <button
                              onClick={() => handleRescheduleAppointment(appointment)}
                              className="flex items-center text-xs text-[#DC2626] hover:underline"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Reschedule
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-8 bg-gray-50 border border-red-100 rounded-md">
                        <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900">No upcoming appointments</h3>
                        <p className="text-gray-600 mt-1">
                          {userType === 'donor'
                            ? 'Schedule a donation to get started'
                            : 'Request a donation when you need blood'}
                        </p>
                      </div>
                    )}
                    {appointments.length > 0 && (
                      <button className="w-full mt-2 bg-transparent border border-red-100 text-gray-900 hover:bg-gray-50 py-2 rounded-md transition-colors">
                        View All Appointments
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h3>
                  <div className="space-y-4">
                    {userNotifications.length > 0 ? (
                      userNotifications.slice(0, 3).map((notification) => (
                        <div key={notification.id || Math.random()} className="flex items-start space-x-4 p-4 rounded-md bg-gray-50 border border-red-100">
                          <div className={`flex-shrink-0 p-2 rounded-md ${notification.type === 'request'
                            ? 'bg-blue-100'
                            : notification.type === 'accepted'
                              ? 'bg-green-100'
                              : 'bg-gray-100'
                            }`}>
                            {notification.type === 'request' ? (
                              <Heart className="h-5 w-5 text-blue-600" />
                            ) : notification.type === 'accepted' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Info className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">{notification.title || 'Notification'}</p>
                            <p className="text-gray-600">{notification.message || ''}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.createdAt?.toDate ?
                                new Date(notification.createdAt.toDate()).toLocaleString() :
                                typeof notification.createdAt === 'string' ?
                                  new Date(notification.createdAt).toLocaleString() :
                                  'Unknown date'}
                            </p>
                          </div>
                          {notification.read === false && (
                            <div className="h-2 w-2 rounded-full bg-[#DC2626]"></div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-8 bg-gray-50 border border-red-100 rounded-md">
                        <Bell className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900">No notifications</h3>
                        <p className="text-gray-600 mt-1">
                          We'll notify you of important updates here
                        </p>
                      </div>
                    )}
                    {userNotifications.length > 0 && (
                      <button
                        className="w-full mt-2 bg-transparent border border-red-100 text-gray-900 hover:bg-gray-50 py-2 rounded-md transition-colors"
                        onClick={() => router.push('/notifications')}
                      >
                        View All Notifications
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Direct Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={userType === 'donor' ? handleDonateNow : handleRequestDonation.bind(null, donations.find(d => d.status === 'available')?.id || '')}
                      className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white py-3 rounded-md transition-colors">
                      {userType === 'donor' ? 'Donate Now' : 'Request Blood'}
                    </button>
                    <button
                      onClick={() => handleRescheduleAppointment()}
                      className="w-full bg-transparent border border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10 py-3 rounded-md transition-colors">
                      {userType === 'donor' ? 'Reschedule Appointment' : 'View Request Status'}
                    </button>
                    <button
                      onClick={handleViewBloodBanks}
                      className="w-full bg-transparent border border-red-100 text-gray-900 hover:bg-gray-50 py-3 rounded-md transition-colors">
                      View Blood Banks
                    </button>
                    <button
                      onClick={handleResetData}
                      className="w-full bg-transparent border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-md transition-colors">
                      Reset Donation Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <DonationScheduleModal
        isOpen={showDonationModal}
        onClose={() => {
          setShowDonationModal(false);
          setAppointmentToReschedule(null);
        }}
        onSubmit={handleDonationSubmit}
        initialData={appointmentToReschedule ? {
          date: appointmentToReschedule.date,
          time: appointmentToReschedule.time,
          location: appointmentToReschedule.location,
          donationType: 'whole_blood',
          specialNotes: ''
        } : undefined}
        isRescheduling={!!appointmentToReschedule}
      />

      <DonationListingForm
        isOpen={showListingModal}
        onClose={() => setShowListingModal(false)}
        onSubmit={handleListingSubmit}
      />
    </div>
  );
}

const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-gray-900"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#DC2626]" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-gray-900"
      >
        R.A.K.T
      </motion.span>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-gray-900"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#DC2626]" />
    </Link>
  );
};