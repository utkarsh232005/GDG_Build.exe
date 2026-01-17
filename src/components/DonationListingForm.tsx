import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { donationAPI } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth-context';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

export interface DonationListingData {
  id: string;
  donorName: string;
  bloodType: string;
  contactNumber: string;
  availability: string;
  location: string;
  additionalInfo: string;
  listedOn: string;
  status: 'available' | 'pending' | 'completed';
  requesterId: string;
  recipientName?: string;

  // Extended Profile
  age?: number;
  gender?: string;
  weight?: number;
  rhFactor?: string;

  // Extended Antigen Profile
  rhVariants?: {
    C?: boolean;
    c?: boolean;
    E?: boolean;
    e?: boolean;
  };
  kell?: boolean;
  duffy?: boolean;
  kidd?: boolean;

  // Eligibility Factors
  lastDonationDate?: string;
  hemoglobinLevel?: number;
  hasChronicIllness?: boolean;
  chronicIllnessDetails?: string;
  recentTravel?: boolean;
  travelDetails?: string;
  recentTattoo?: boolean;
  tattooDate?: string;
  recentSurgery?: boolean;
  surgeryDetails?: string;
  currentMedications?: string;
  allergies?: string;

  // Absolute Eligibility (Safety)
  hivStatus?: boolean;
  hepatitisB?: boolean;
  hepatitisC?: boolean;
  htlv?: boolean;
  ivDrugUse?: boolean;

  // Temporary Eligibility
  recentColdFlu?: boolean;
  recentVaccination?: boolean;
  vaccinationDate?: string;
  vaccinationType?: string;
  pregnant?: boolean;

  // Donation History
  totalDonations?: number;
  preferredDonationCenter?: string;
  willingForEmergency?: boolean;
  preferredContactMethod?: 'phone' | 'email' | 'sms';
}

interface DonationListingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DonationListingData) => void;
}

const INITIAL_FORM_STATE = {
  // Core
  bloodType: '',
  rhFactor: '',
  contactNumber: '',
  availability: '',
  location: '',
  additionalInfo: '',
  age: '',
  gender: '',
  weight: '',

  // Extended antigens
  rhVariants: { C: false, c: false, E: false, e: false },
  kell: false,
  duffy: false,
  kidd: false,

  // Eligibility & health
  lastDonationDate: '',
  hemoglobinLevel: '',
  hasChronicIllness: false,
  chronicIllnessDetails: '',
  recentTravel: false,
  travelDetails: '',
  recentTattoo: false,
  tattooDate: '',
  recentSurgery: false,
  surgeryDetails: '',
  currentMedications: '',
  allergies: '',

  // Absolute eligibility (hard stops)
  hivStatus: false,
  hepatitisB: false,
  hepatitisC: false,
  htlv: false,
  ivDrugUse: false,

  // Temporary eligibility
  recentColdFlu: false,
  recentVaccination: false,
  vaccinationDate: '',
  vaccinationType: '',
  pregnant: false,

  // History & preferences
  totalDonations: '',
  preferredDonationCenter: '',
  willingForEmergency: true,
  preferredContactMethod: 'phone',
};

const DonationListingForm = ({ isOpen, onClose, onSubmit }: DonationListingFormProps) => {
  const { user, userData, updateUserRole } = useAuth(); // Get updateUserRole from useAuth
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    console.log("DonationListingForm mounted - V2");
  }, []);

  const handleBooleanChange = (name: string, value: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    if (apiError) setApiError(null);
  };

  const handleRhVariantChange = (key: 'C' | 'c' | 'E' | 'e', value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      rhVariants: { ...prev.rhVariants, [key]: value },
    }));
    if (apiError) setApiError(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.bloodType) newErrors.bloodType = 'Blood type is required';
    if (!formData.contactNumber) newErrors.contactNumber = 'Contact number is required';
    if (!formData.availability) newErrors.availability = 'Availability is required';
    if (!formData.location) newErrors.location = 'Location is required';

    // Hard-stop exclusions
    const hardStops = [
      formData.hivStatus,
      formData.hepatitisB,
      formData.hepatitisC,
      formData.htlv,
      formData.ivDrugUse,
    ];
    if (hardStops.some(Boolean)) {
      toast.error('Eligibility check failed: donor is permanently deferred (HIV/Hepatitis/HTLV/IV drug use).');
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field-specific error when user edits the field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Clear API error when user makes any changes
    if (apiError) setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Early return if already submitting to prevent double-submission
    if (isSubmitting) return;

    if (!validateForm()) return;

    // Set submitting state immediately
    setIsSubmitting(true);
    setApiError(null);

    // Make a local copy of form data that we'll use for the API call
    // This prevents any state updates during the submission process
    const submissionData = { ...formData };

    // Generate a submission ID for deduplication
    const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const toastId = toast.loading('Creating donation listing...');

    try {
      // First make sure user has donor role
      if (!user) {
        throw new Error('You must be logged in to create a donation listing');
      }

      // First clear the form to prevent duplicate submissions if user clicks multiple times
      // First clear the form to prevent duplicate submissions if user clicks multiple times
      setFormData(INITIAL_FORM_STATE);

      // Close the modal immediately before API call
      onClose();

      // Call the API to create the donation
      console.log(`Submitting donation data (ID: ${submissionId}):`, submissionData);
      const response = await donationAPI.createDonation({
        ...submissionData,
        submissionId, // Pass the submission ID to help with deduplication
      });

      console.log('Donation created successfully:', response);

      // Format the data for the parent component
      const newDonation: DonationListingData = {
        id: `donation-${response.id}`,
        donorName: 'donorName' in response ? response.donorName : 'You',
        bloodType: submissionData.bloodType,
        contactNumber: submissionData.contactNumber,
        availability: submissionData.availability,
        location: submissionData.location,
        additionalInfo: submissionData.additionalInfo,
        listedOn: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        status: 'available',
        requesterId: '',
      };

      // Notify parent of success
      onSubmit(newDonation);

      // Show success message (parent component will now handle this)
      toast.success('Donation listed successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Error listing donation:', error);
      const errorMessage = error.message || 'Failed to list donation. Please try again.';
      setApiError(errorMessage);
      toast.error('Failed to list donation. Please try again', { id: toastId });

      // Don't re-open modal on error, just show the error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#ffffff] rounded-lg shadow-xl w-full max-w-3xl border border-[#fecaca] max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-[#fecaca]">
          <h2 className="text-xl font-semibold text-gray-900">List Your Donation</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Display API errors */}
          {apiError && (
            <div className="bg-red-900/20 border border-red-800 rounded-md p-3 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm">{apiError}</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="bloodType" className="block text-sm font-medium text-gray-600">
              Blood Type <span className="text-red-500">*</span>
            </label>
            <select
              id="bloodType"
              name="bloodType"
              value={formData.bloodType}
              onChange={handleChange}
              className={`w-full bg-[#f9fafb] border ${errors.bloodType ? 'border-red-800' : 'border-[#fecaca]'} rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]`}
            >
              <option value="">Select Blood Type</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
            {errors.bloodType && <p className="text-red-500 text-xs mt-1">{errors.bloodType}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-600">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              id="contactNumber"
              name="contactNumber"
              type="tel"
              value={formData.contactNumber}
              onChange={handleChange}
              placeholder="Your contact number"
              className={`w-full bg-[#f9fafb] border ${errors.contactNumber ? 'border-red-800' : 'border-[#fecaca]'} rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]`}
            />
            {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="availability" className="block text-sm font-medium text-gray-600">
              Availability <span className="text-red-500">*</span>
            </label>
            <input
              id="availability"
              name="availability"
              type="text"
              value={formData.availability}
              onChange={handleChange}
              placeholder="e.g., Weekdays after 5pm, Weekends only"
              className={`w-full bg-[#f9fafb] border ${errors.availability ? 'border-red-800' : 'border-[#fecaca]'} rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]`}
            />
            {errors.availability && <p className="text-red-500 text-xs mt-1">{errors.availability}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="location" className="block text-sm font-medium text-gray-600">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleChange}
              placeholder="City, State or Hospital/Clinic Name"
              className={`w-full bg-[#f9fafb] border ${errors.location ? 'border-red-800' : 'border-[#fecaca]'} rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]`}
            />
            {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
          </div>

          <hr className="border-gray-200" />

          {/* Demographics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="age" className="block text-sm font-medium text-gray-600">
                Age
              </label>
              <input
                id="age"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleChange}
                placeholder="Years"
                className="w-full bg-[#f9fafb] border border-[#fecaca] rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="gender" className="block text-sm font-medium text-gray-600">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full bg-[#f9fafb] border border-[#fecaca] rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="weight" className="block text-sm font-medium text-gray-600">
                Weight (kg)
              </label>
              <input
                id="weight"
                name="weight"
                type="number"
                value={formData.weight}
                onChange={handleChange}
                placeholder="kg"
                className="w-full bg-[#f9fafb] border border-[#fecaca] rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
              />
            </div>
          </div>

          {/* Medical Eligibility (Hard Stops) */}
          <div className="border border-red-200 rounded-md p-4 bg-red-50 space-y-3">
            <h3 className="text-sm font-semibold text-red-800 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Safety & Eligibility (Hard Stops)
            </h3>
            <p className="text-xs text-red-600 mb-2">
              Do you have a history of any of the following? (Selecting these may permanently exclude matching)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { key: 'hivStatus', label: 'HIV Positive' },
                { key: 'hepatitisB', label: 'Hepatitis B' },
                { key: 'hepatitisC', label: 'Hepatitis C' },
                { key: 'htlv', label: 'HTLV Positive' },
                { key: 'ivDrugUse', label: 'History of IV Drug Use' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[key as keyof typeof formData] as boolean}
                    onChange={(e) => handleBooleanChange(key, e.target.checked)}
                    className="rounded border-red-300 text-red-600 focus:ring-red-500 h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Temporary Eligibility & History */}
          <div className="bg-gray-50 p-4 rounded-md space-y-3 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">Temporary Eligibility & Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: 'recentColdFlu', label: 'Recent Cold/Flu' },
                { key: 'recentTattoo', label: 'Recent Tattoo/Piercing' },
                { key: 'recentSurgery', label: 'Recent Surgery' },
                { key: 'pregnant', label: 'Pregnant/Recent Delivery' },
                { key: 'recentVaccination', label: 'Recent Vaccination' },
                { key: 'recentTravel', label: 'Recent Travel' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[key as keyof typeof formData] as boolean}
                    onChange={(e) => handleBooleanChange(key, e.target.checked)}
                    className="rounded border-gray-300 text-gray-600 focus:ring-gray-500 h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-600">Last Donation Date</label>
                <input
                  type="date"
                  name="lastDonationDate"
                  value={formData.lastDonationDate}
                  onChange={handleChange}
                  className="w-full text-sm bg-white border border-[#fecaca] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-600">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  name="hemoglobinLevel"
                  value={formData.hemoglobinLevel}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="e.g. 13.5"
                  className="w-full text-sm bg-white border border-[#fecaca] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
                />
              </div>
            </div>
          </div>

          {/* Extended Antigen Profile */}
          <div className="bg-blue-50 p-4 rounded-md space-y-3 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800">Extended Antigen Profile (Optional)</h3>
            <p className="text-xs text-blue-600 mb-2">Select if you know you are <strong>POSITIVE</strong> for these antigens. Leave unchecked if negative or unknown.</p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Rh Variants</span>
              <div className="flex flex-wrap gap-4">
                {['C', 'c', 'E', 'e'].map((variant) => (
                  <label key={variant} className="flex items-center space-x-1 cursor-pointer bg-white px-3 py-1 rounded border border-blue-100 shadow-sm">
                    <input
                      type="checkbox"
                      checked={formData.rhVariants[variant as 'C' | 'c' | 'E' | 'e']}
                      onChange={(e) => handleRhVariantChange(variant as 'C' | 'c' | 'E' | 'e', e.target.checked)}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-700">{variant}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Other Antigens</span>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'kell', label: 'Kell (K)' },
                  { key: 'duffy', label: 'Duffy' },
                  { key: 'kidd', label: 'Kidd' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center space-x-1 cursor-pointer bg-white px-3 py-1 rounded border border-blue-100 shadow-sm">
                    <input
                      type="checkbox"
                      checked={formData[key as keyof typeof formData] as boolean}
                      onChange={(e) => handleBooleanChange(key, e.target.checked)}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-600">
              Additional Information <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="additionalInfo"
              name="additionalInfo"
              value={formData.additionalInfo}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional details you want to share"
              className="w-full bg-[#f9fafb] border border-[#fecaca] rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#DC2626] focus:border-[#DC2626]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#fecaca] rounded-md text-gray-900 hover:bg-[#f9fafb] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-gray-900 rounded-md transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  List Donation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonationListingForm;
