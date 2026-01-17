import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { get, ref, set, update, push as rtdbPush, push } from 'firebase/database';
import { auth, db, rtdb } from './firebase-config';
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Base API URL
const API_BASE_URL = 'http://localhost:8082';

// Auth token management is handled by Firebase Authentication
const TOKEN_KEY = 'auth_token';

// Check if user is authenticated using Firebase Auth
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};

// Get current user info
export const getCurrentUser = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      return {
        ...userDoc.data(),
        uid: currentUser.uid,
        email: currentUser.email
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

// Authentication API
export const authAPI = {
  register: async (userData: any) => {
    try {
      const { email, password, ...profileData } = userData;

      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create a valid full name from first and last name
      const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || 'Anonymous User';

      // Save profile data to Firestore with sanitized properties
      const sanitizedProfileData = {
        ...profileData,
        // Add these required fields with default values
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        name: fullName, // Explicitly add the name field
        email,
        createdAt: Timestamp.now(),
        role: userData.role || 'donor',
      };

      // Save to Firestore with the name field explicitly set
      await setDoc(doc(db, 'users', user.uid), sanitizedProfileData);

      // Save to Realtime DB for online status - explicitly set name
      const rtdbUserData = {
        name: fullName, // Use the same fullName value
        email,
        bloodType: profileData.bloodType || 'Unknown',
        online: true,
        lastActive: new Date().toISOString()
      };

      console.log("Saving user to RTDB with data:", rtdbUserData);
      await set(ref(rtdb, `users/${user.uid}`), rtdbUserData);

      // Add to blood type group (only if bloodType is defined)
      if (profileData.bloodType) {
        await set(ref(rtdb, `bloodGroups/${profileData.bloodType}/${user.uid}`), true);
      }

      return {
        user: {
          uid: user.uid,
          email: user.email
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  login: async (credentials: { email: string; password: string }) => {
    try {
      // Add device info to the login request
      const deviceInfo = {
        ...getBrowserInfo()
      };

      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );
      const user = userCredential.user;

      // Update user's last login and device info
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now(),
        lastDevice: deviceInfo
      });

      // Update online status in Realtime Database
      await update(ref(rtdb, `users/${user.uid}`), {
        online: true,
        lastActive: new Date().toISOString()
      });

      return {
        user: {
          uid: user.uid,
          email: user.email
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    const user = auth.currentUser;

    if (user) {
      // Update online status before signing out
      await update(ref(rtdb, `users/${user.uid}`), {
        online: false,
        lastActive: new Date().toISOString()
      });
    }

    return signOut(auth);
  }
};

// Helper function to get browser and device information
const getBrowserInfo = (): any => {
  if (typeof window === 'undefined') return { device: 'server' };

  const userAgent = window.navigator.userAgent;
  return {
    userAgent,
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
    device: detectDevice(userAgent),
    time: new Date().toISOString()
  };
};

// Simple browser detection
const detectBrowser = (userAgent: string): string => {
  if (userAgent.indexOf("Firefox") > -1) return "Firefox";
  if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) return "Opera";
  if (userAgent.indexOf("Edge") > -1) return "Edge";
  if (userAgent.indexOf("Chrome") > -1) return "Chrome";
  if (userAgent.indexOf("Safari") > -1) return "Safari";
  if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) return "Internet Explorer";
  return "Unknown";
};

// Simple OS detection
const detectOS = (userAgent: string): string => {
  if (userAgent.indexOf("Windows") > -1) return "Windows";
  if (userAgent.indexOf("Mac") > -1) return "MacOS";
  if (userAgent.indexOf("Linux") > -1) return "Linux";
  if (userAgent.indexOf("Android") > -1) return "Android";
  if (userAgent.indexOf("iOS") > -1 || userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) return "iOS";
  return "Unknown";
};

// Simple device detection
const detectDevice = (userAgent: string): string => {
  if (userAgent.indexOf("Mobile") > -1) return "Mobile";
  if (userAgent.indexOf("Tablet") > -1) return "Tablet";
  return "Desktop";
};

// User API
export const userAPI = {
  getProfile: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) throw new Error('User profile not found');

    return {
      ...userDoc.data(),
      uid: user.uid,
      email: user.email
    };
  },

  getAllUsers: async () => {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  getDonorsByBloodType: async (bloodType: string) => {
    const donorsQuery = query(
      collection(db, 'users'),
      where('bloodType', '==', bloodType),
      where('role', '==', 'donor')
    );

    const donorsSnapshot = await getDocs(donorsQuery);
    return donorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  updateProfile: async (userData: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Update Firestore document
    await updateDoc(doc(db, 'users', user.uid), {
      ...userData,
      updatedAt: Timestamp.now()
    });

    // Update relevant fields in Realtime Database
    const rtdbUpdate: any = {};
    if (userData.name) rtdbUpdate.name = userData.name;
    if (userData.bloodType) rtdbUpdate.bloodType = userData.bloodType;

    await update(ref(rtdb, `users/${user.uid}`), rtdbUpdate);

    // If blood type changed, update blood group memberships
    if (userData.bloodType && userData.previousBloodType && userData.previousBloodType !== userData.bloodType) {
      // Remove from old blood group
      await set(ref(rtdb, `bloodGroups/${userData.previousBloodType}/${user.uid}`), null);
      // Add to new blood group
      await set(ref(rtdb, `bloodGroups/${userData.bloodType}/${user.uid}`), true);
    }

    return { success: true };
  },

  updateRole: async (role: 'donor' | 'recipient'): Promise<void> => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Standardize role to uppercase for consistency
      const roleUppercase = role.toUpperCase();

      // Update Firestore directly instead of using API endpoint
      await updateDoc(doc(db, 'users', user.uid), {
        role: roleUppercase,
        updatedAt: Timestamp.now()
      });

      // Update realtime database as well
      await update(ref(rtdb, `users/${user.uid}`), {
        role: roleUppercase,
        updatedAt: new Date().toISOString()
      });

      console.log(`User role updated to ${roleUppercase}`);

      // Also store local token for API auth if needed
      localStorage.setItem('userRole', roleUppercase);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
};

// Blood Request API
export const bloodRequestAPI = {
  getAllRequests: async () => {
    const requestsSnapshot = await getDocs(
      query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
    );

    return requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  createRequest: async (requestData: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newRequest = {
      ...requestData,
      userId: user.uid,
      userEmail: user.email,
      status: 'pending',
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'requests'), newRequest);

    // Also add to realtime database for notifications
    await set(ref(rtdb, `requests/${docRef.id}`), {
      ...newRequest,
      id: docRef.id,
      createdAt: new Date().toISOString()
    });

    return {
      id: docRef.id,
      ...newRequest
    };
  },

  acceptRequest: async (requestId: string, donorId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Update request in Firestore
    await updateDoc(doc(db, 'requests', requestId), {
      status: 'accepted',
      donorId: donorId,
      acceptedAt: Timestamp.now()
    });

    // Update in Realtime Database
    await update(ref(rtdb, `requests/${requestId}`), {
      status: 'accepted',
      donorId: donorId,
      acceptedAt: new Date().toISOString()
    });

    return { success: true };
  },

  getMyRequests: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const myRequestsQuery = query(
      collection(db, 'requests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const requestsSnapshot = await getDocs(myRequestsQuery);
    return requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
};

// Donation API
export const donationAPI = {
  // Get all available donations - improved error handling
  getAvailableDonations: async () => {
    try {
      console.log("Getting available donations from Firestore");
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      try {
        // First check if the collection exists
        const donationsRef = collection(db, 'donations');
        const donationsSnapshot = await getDocs(
          query(donationsRef, where('status', '==', 'available'), limit(100))
        );

        console.log(`Found ${donationsSnapshot.size} available donations`);

        // Map the data with error handling
        const donations = donationsSnapshot.docs.map(doc => {
          try {
            const data = doc.data();
            return {
              id: doc.id,
              donorId: data.donorId || '',
              donorName: data.donorName || 'Anonymous',
              bloodType: data.bloodType || 'Unknown',
              contactNumber: data.contactNumber || 'N/A',
              availability: data.availability || 'N/A',
              location: data.location || 'N/A',
              additionalInfo: data.additionalInfo || '',
              status: data.status || 'available',
              recipientId: data.recipientId || '',
              createdAt: data.createdAt?.toDate?.() || new Date(),
              listedOn: data.listedOn || new Date().toISOString()
            };
          } catch (err) {
            console.error("Error processing donation document:", err, doc.id);
            return null;
          }
        }).filter(Boolean); // Remove any nulls

        console.log("Processed donations:", donations.length);
        return donations;
      } catch (error) {
        console.error("Error getting available donations:", error);
        return []; // Return empty array on error
      }
    } catch (error) {
      console.error("Error in getAvailableDonations:", error);
      return []; // Return empty array on error
    }
  },

  // Get current user's donations (as donor) - with improved error handling
  getMyDonations: async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      console.log("Getting donations for user:", user.uid);

      // Query Firestore for donations where donorId equals the current user's ID
      const donationsRef = collection(db, 'donations');
      const q = query(
        donationsRef,
        where('donorId', '==', user.uid)
      );

      console.log("Executing Firestore query for user donations");
      const querySnapshot = await getDocs(q);
      console.log("Query complete, documents found:", querySnapshot.size);

      // Convert query snapshot to array of donation objects with better error handling
      const donations = querySnapshot.docs.map(doc => {
        try {
          const data = doc.data();
          return {
            id: doc.id,
            donorId: data.donorId || '',
            donorName: data.donorName || 'Anonymous',
            bloodType: data.bloodType || 'Unknown',
            contactNumber: data.contactNumber || 'N/A',
            availability: data.availability || 'N/A',
            location: data.location || 'N/A',
            additionalInfo: data.additionalInfo || '',
            status: data.status || 'available',
            recipientId: data.recipientId || '',
            createdAt: data.createdAt?.toDate?.() || new Date(),
            listedOn: data.listedOn || new Date().toISOString()
          };
        } catch (err) {
          console.error("Error processing donation document:", err, doc.id);
          return null;
        }
      }).filter(Boolean); // Remove any null items

      console.log("Parsed donations:", donations.length, donations);
      return donations;
    } catch (error) {
      console.error("Error getting user donations:", error);
      return []; // Return empty array on error instead of throwing
    }
  },

  // Create a new donation listing - improved error handling and structure
  createDonation: async (donationData: any) => {
    try {
      // First check if the user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.error("Authentication error: No user is signed in");
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Get user profile to check role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User profile not found. Please complete your profile first.');
      }

      const userData = userDoc.data();

      // Always update the role to DONOR before attempting to create a donation
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: 'DONOR',
          updatedAt: Timestamp.now()
        });
      } catch (roleError) {
        console.error("Error updating role:", roleError);
        // Continue anyway - the donation might still work
      }

      // Ensure we have all required fields
      if (!donationData.bloodType) throw new Error("Blood type is required");
      if (!donationData.contactNumber) throw new Error("Contact number is required");
      if (!donationData.availability) throw new Error("Availability is required");
      if (!donationData.location) throw new Error("Location is required");

      // Prepare donor name using first and last name if available
      const donorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Anonymous';

      // Generate a unique clientId that combines multiple approaches to ensure uniqueness
      const clientId = donationData.submissionId ||
        `${user.uid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create a hash of the donation data to detect duplicates with similar content
      const contentHash = hashDonationContent({
        bloodType: donationData.bloodType,
        contactNumber: donationData.contactNumber,
        availability: donationData.availability,
        location: donationData.location,
        additionalInfo: donationData.additionalInfo || "",
        donorId: user.uid
      });

      // Create the donation document with proper time fields
      // Exclude submissionId from the saved document
      const { submissionId, ...otherDonationData } = donationData;
      
      const newDonation = {
        ...otherDonationData, // Spread all other fields (age, gender, rhVariants, eligibility flags, etc.)
        status: 'available',
        donorId: user.uid,
        donorName: donorName,
        donorEmail: user.email,
        createdAt: Timestamp.now(),
        listedOn: new Date().toISOString(),
        updatedAt: Timestamp.now(),
        clientId: clientId,
        contentHash: contentHash
      };

      // Handle index errors more gracefully when checking for duplicates
      try {
        // Check for duplicates - first by clientId
        const donationsRef = collection(db, 'donations');

        console.log(`Checking for existing donation with clientId: ${clientId}`);
        let existingQuery = query(
          donationsRef,
          where('clientId', '==', clientId),
          limit(1)
        );

        let existingDocs = await getDocs(existingQuery);

        // If no duplicates by clientId, also check for contentHash for recent donations
        if (existingDocs.empty) {
          try {
            console.log(`Checking for similar donation with contentHash: ${contentHash}`);

            // Check donations from this user with the same content in the last 5 minutes
            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

            existingQuery = query(
              donationsRef,
              where('donorId', '==', user.uid),
              where('contentHash', '==', contentHash),
              where('createdAt', '>', Timestamp.fromDate(fiveMinutesAgo)),
              limit(1)
            );

            existingDocs = await getDocs(existingQuery);
          } catch (indexError) {
            console.warn("Index error during content hash check - proceeding with creation:", indexError);
            // Skip the content hash check if the index isn't ready
            // Use a new query without the problematic filters to get a valid QuerySnapshot
            existingQuery = query(
              donationsRef,
              where('donorId', '==', user.uid),
              limit(0)
            );
            existingDocs = await getDocs(existingQuery);
          }
        }

        // Return existing donation if found to prevent duplicate
        if (!existingDocs.empty) {
          console.log("Duplicate donation detected, returning existing entry");
          const existingDoc = existingDocs.docs[0];
          return {
            id: existingDoc.id,
            ...existingDoc.data()
          };
        }
      } catch (indexError) {
        console.warn("Error during duplicate checks - proceeding with creation:", indexError);
        // Continue with donation creation even if the index checks fail
      }

      // Save to Firestore if no duplicate found or if duplicate checks failed
      console.log("Creating new donation document");
      const docRef = await addDoc(collection(db, 'donations'), newDonation);
      console.log("Donation document created with ID:", docRef.id);

      // Return the created document with ID and donor info
      return {
        id: docRef.id,
        ...newDonation
      };
    } catch (error: any) {
      console.error("Error creating donation:", error);
      throw error;
    }
  },

  // Request a donation as a recipient
  requestDonation: async (donationId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Get user data for the recipient name
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      // Update donation status to 'pending' instead of 'requested'
      await updateDoc(doc(db, 'donations', donationId), {
        status: 'pending', // Changed from 'requested' to 'pending'
        recipientId: user.uid,
        recipientEmail: user.email,
        recipientName: userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}` : user.displayName || 'Anonymous Recipient',
        requestedAt: Timestamp.now()
      });

      // Add a notification for the donor
      try {
        const donationDoc = await getDoc(doc(db, 'donations', donationId));
        if (donationDoc.exists()) {
          const donationData = donationDoc.data();
          const donorId = donationData.donorId;

          // Create notification in Firestore
          await addDoc(collection(db, 'notifications'), {
            userId: donorId,
            type: 'request',
            title: 'New Donation Request',
            message: `Someone has requested your ${donationData.bloodType} blood donation.`,
            donationId: donationId,
            read: false,
            createdAt: Timestamp.now()
          });

          // Also add to realtime database for immediate delivery
          await rtdbPush(ref(rtdb, `users/${donorId}/notifications`), {
            type: 'request',
            title: 'New Donation Request',
            message: `Someone has requested your ${donationData.bloodType} blood donation.`,
            donationId: donationId,
            read: false,
            createdAt: new Date().toISOString()
          });
        }

        // Dispatch event to refresh UI
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            console.log("Dispatching donation-data-changed event after request");
            window.dispatchEvent(new CustomEvent('donation-data-changed'));
          }
        }, 1000);
      } catch (error) {
        console.error("Error creating notification:", error);
        // Continue anyway since the request was successful
      }

      return { success: true };
    } catch (error) {
      console.error("Error requesting donation:", error);
      throw error;
    }
  },

  // Reject a donation request (donor rejects)
  rejectDonationRequest: async (donationId: string, recipientId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Verify user is the donor
      const donationDoc = await getDoc(doc(db, 'donations', donationId));
      if (!donationDoc.exists()) throw new Error('Donation not found');

      const donationData = donationDoc.data();
      if (donationData.donorId !== user.uid) throw new Error('Only the donor can reject this request');

      // Update donation status back to available
      await updateDoc(doc(db, 'donations', donationId), {
        status: 'available',
        recipientId: null,
        recipientEmail: null,
        recipientName: null,
        requestedAt: null
      });

      // Create notification for the recipient
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const donorName = userData && userData.firstName ?
          `${userData.firstName} ${userData.lastName || ''}` :
          user.displayName || 'A donor';

        // Create notification in Firestore
        await addDoc(collection(db, 'notifications'), {
          userId: recipientId,
          type: 'rejected',
          title: 'Donation Request Rejected',
          message: `${donorName} has declined your blood donation request.`,
          donationId: donationId,
          read: false,
          createdAt: Timestamp.now()
        });

        // Also add to realtime database for immediate delivery
        await rtdbPush(ref(rtdb, `users/${recipientId}/notifications`), {
          type: 'rejected',
          title: 'Donation Request Rejected',
          message: `${donorName} has declined your blood donation request.`,
          donationId: donationId,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error creating notification:", error);
        // Continue anyway since the rejection was successful
      }

      // Dispatch event to refresh UI
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log("Dispatching donation-data-changed event");
          window.dispatchEvent(new CustomEvent('donation-data-changed'));
        }
      }, 1000);

      return { success: true };
    } catch (error) {
      console.error("Error rejecting donation request:", error);
      throw error;
    }
  },

  // Accept a donation request (donor accepts a recipient's request)
  acceptDonationRequest: async (donationId: string, recipientId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Verify user is the donor
    const donationDoc = await getDoc(doc(db, 'donations', donationId));
    if (!donationDoc.exists()) throw new Error('Donation not found');

    const donationData = donationDoc.data();
    if (donationData.donorId !== user.uid) throw new Error('Only the donor can accept this request');

    // Update donation status
    await updateDoc(doc(db, 'donations', donationId), {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });

    // Create notification for the recipient
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const donorName = userData && userData.firstName ?
        `${userData.firstName} ${userData.lastName || ''}` :
        user.displayName || 'A donor';

      // Create notification in Firestore
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        type: 'accepted',
        title: 'Donation Request Accepted',
        message: `${donorName} has accepted your blood donation request.`,
        donationId: donationId,
        read: false,
        createdAt: Timestamp.now()
      });

      // Also add to realtime database for immediate delivery
      await rtdbPush(ref(rtdb, `users/${recipientId}/notifications`), {
        type: 'accepted',
        title: 'Donation Request Accepted',
        message: `${donorName} has accepted your blood donation request.`,
        donationId: donationId,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      // Continue anyway since the acceptance was successful
    }

    // Dispatch event to refresh UI
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        console.log("Dispatching donation-data-changed event");
        window.dispatchEvent(new CustomEvent('donation-data-changed'));
      }
    }, 1000);

    return { success: true };
  },

  // Confirm a donation (donor confirms)
  confirmDonation: async (donationId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Verify user is the donor
    const donationDoc = await getDoc(doc(db, 'donations', donationId));
    if (!donationDoc.exists()) throw new Error('Donation not found');

    const donationData = donationDoc.data();
    if (donationData.donorId !== user.uid) throw new Error('Only the donor can confirm this donation');

    await updateDoc(doc(db, 'donations', donationId), {
      status: 'completed',
      completedAt: Timestamp.now()
    });

    // Dispatch event to refresh UI
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        console.log("Dispatching donation-data-changed event");
        window.dispatchEvent(new CustomEvent('donation-data-changed'));
      }
    }, 1000);

    return { success: true };
  },

  // Cancel a donation request (recipient cancels)
  cancelRequest: async (donationId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Verify user is the recipient
    const donationDoc = await getDoc(doc(db, 'donations', donationId));
    if (!donationDoc.exists()) throw new Error('Donation not found');

    const donationData = donationDoc.data();
    if (donationData.recipientId !== user.uid) throw new Error('Only the recipient can cancel this request');

    await updateDoc(doc(db, 'donations', donationId), {
      status: 'available',
      recipientId: null,
      recipientEmail: null,
      requestedAt: null
    });

    // Dispatch event to refresh UI
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        console.log("Dispatching donation-data-changed event");
        window.dispatchEvent(new CustomEvent('donation-data-changed'));
      }
    }, 1000);

    return { success: true };
  },

  // Get user's notifications
  getNotifications: async () => {
    try {
      const user = auth.currentUser;
      if (!user) return []; // Return empty array if not authenticated

      console.log("Fetching notifications for user:", user.uid);

      // Try to get notifications from Firestore first
      try {
        // Simplify the query to avoid the need for a complex index
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          // Remove orderBy for now until the index is created
          limit(50)
        );

        const notificationsSnapshot = await getDocs(notificationsQuery);
        let notificationsData = notificationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Array<{ id: string; createdAt?: { toDate?: () => Date } } & Record<string, any>>;

        // Sort in memory instead (less efficient but works without index)
        notificationsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime(); // descending (newest first)
        });

        return notificationsData;
      } catch (firestoreError) {
        console.error("Error fetching notifications from Firestore:", firestoreError);

        // If Firestore fails, try real-time database as fallback
        try {
          console.log("Attempting to fetch notifications from Realtime DB as fallback");
          const notificationsRef = ref(rtdb, `users/${user.uid}/notifications`);
          const snapshot = await get(notificationsRef);

          if (snapshot.exists()) {
            // Convert realtime DB format to array
            const notificationsObj = snapshot.val();
            return Object.keys(notificationsObj).map(key => ({
              id: key,
              ...notificationsObj[key],
              // Ensure createdAt is a Firestore timestamp for compatibility
              createdAt: {
                toDate: () => new Date(notificationsObj[key].createdAt)
              }
            }));
          }
        } catch (rtdbError) {
          console.error("Fallback also failed:", rtdbError);
        }

        // If all fails, return empty array
        return [];
      }
    } catch (error) {
      console.error("Error in getNotifications:", error);
      return []; // Return empty array on error
    }
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });

    return { success: true };
  },

  getHospitalAppointments: async (hospitalId: string) => {
    try {
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('hospitalId', '==', hospitalId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(appointmentsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching hospital appointments:', error);
      throw error;
    }
  },

  createBloodRequest: async (requestData: any) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const docRef = await addDoc(collection(db, 'bloodRequests'), {
        ...requestData,
        createdAt: Timestamp.now(),
        status: 'active'
      });

      // Create notification for matching donors
      const notificationData = {
        type: requestData.urgency === 'emergency' ? 'emergency' : 'request',
        title: `${requestData.urgency.toUpperCase()} Blood Request`,
        message: `${requestData.units} units of ${requestData.bloodType} blood needed at ${requestData.location}`,
        requestId: docRef.id,
        createdAt: Date.now()
      };

      // Add to blood type specific notification channel
      await push(ref(rtdb, `notifications/bloodType/${requestData.bloodType}`), notificationData);

      return {
        id: docRef.id,
        ...requestData
      };
    } catch (error) {
      console.error('Error creating blood request:', error);
      throw error;
    }
  },

  updateAppointmentStatus: async (appointmentId: string, status: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: status,
        updatedAt: Timestamp.now()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating appointment status:', error);
      throw error;
    }
  }
};

// Helper function to create a content hash for deduplication
function hashDonationContent(data: any): string {
  // Simple string-based hash
  const normalizedString = Object.entries(data)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}:${value}`)
    .sort()
    .join('|')
    .toLowerCase();

  // Basic hash function
  let hash = 0;
  for (let i = 0; i < normalizedString.length; i++) {
    const char = normalizedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(16);
}