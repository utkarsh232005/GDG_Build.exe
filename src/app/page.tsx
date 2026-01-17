'use client';

import { useState, useEffect } from 'react';
import TextType from '@/components/TextType';
import { Bell, Droplet, Heart, Users, LogIn, UserPlus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import React from "react";
import SplitText from "@/components/ui/SplitText";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  NavbarButton
} from "@/components/ui/resizable-navbar";

export default function Home() {
  const router = useRouter();
  const { error } = useAuth();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Resizable Navbar */}
      <Navbar>
        <NavBody>
          <div className="flex items-center space-x-2 w-full max-w-[200px]">
            <Droplet className="h-8 w-8 text-[#DC2626]" />
            <h1 className="text-2xl font-bold text-gray-900">
              R.A.<span className="text-[#DC2626]">K.T</span>
            </h1>
          </div>

          {/* Centered Nav Items */}
          <NavItems
            items={[
              { name: "Home", link: "/" },
              { name: "Donate", link: "/auth/register" },
              { name: "Find Blood", link: "/blood-requests" },
              { name: "About", link: "#" },
            ]}
            className="hidden lg:flex"
          />

          {/* Right Action Buttons */}
          <div className="flex items-center justify-end space-x-4 w-full max-w-[200px]">
            <NavbarButton
              href="/auth/login"
              variant="secondary"
              className="text-[#DC2626] font-semibold hover:bg-red-50"
            >
              Login
            </NavbarButton>
            <NavbarButton
              href="/auth/register"
              className="bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-none"
            >
              Sign Up
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav className="lg:hidden">
          <MobileNavHeader>
            <div className="flex items-center space-x-2">
              <Droplet className="h-6 w-6 text-[#DC2626]" />
              <span className="text-xl font-bold text-gray-900">
                R.A.<span className="text-[#DC2626]">K.T</span>
              </span>
            </div>
            {/* Mobile Toggle Logic would go here - for now simplified */}
            <Link href="/auth/login" className="text-[#DC2626] font-medium text-sm">
              Login
            </Link>
          </MobileNavHeader>
        </MobileNav>
      </Navbar>


      {/* Hero Section with Video Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background - centered focus */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
        >
          {/* Add your video source here */}
          <source src="videos/Video_Spelling_Correction_Provided.mp4" type="video/mp4" />
          {/* Fallback for browsers that don't support video */}
          Your browser does not support the video tag.
        </video>

        {/* Light overlay for text readability */}
        <div className="absolute inset-0 bg-white/30"></div>

        {/* Content - Centered */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <SplitText
            text="Give The Gift"
            className="text-5xl md:text-7xl font-bold font-heading text-white tracking-widest text-stroke-black"
            tag="h1"
            delay={80}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 50 }}
            to={{ opacity: 1, y: 0 }}
            textAlign="center"
          />
          <SplitText
            text="of Life"
            className="text-5xl md:text-7xl font-bold font-heading text-white tracking-widest mt-2 text-stroke-black"
            tag="h1"
            delay={80}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 50 }}
            to={{ opacity: 1, y: 0 }}
            textAlign="center"
          />
          <TextType
            as="p"
            className="mt-6 text-xl text-gray-800 max-w-lg mx-auto font-medium"
            text="Every drop of blood you donate can save a life. Join our community of heroes today."
            typingSpeed={50}
            cursorCharacter="|"
            loop={false}
          />
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="px-8 py-4 rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] transition-colors shadow-lg"
            >
              Become a Donor
            </Link>
            <Link
              href="/blood-requests"
              className="px-8 py-4 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-900 transition-colors shadow-lg"
            >
              Find Blood
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Why Choose <span className="text-[#DC2626]">Blood</span>Connect?
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Join our mission to ensure blood availability for everyone in need
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-[#DC2626]/10 rounded-lg flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-[#DC2626]" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-time Matching
              </h3>
              <p className="text-gray-600">
                Instantly connect with compatible donors in your area when blood is needed.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-[#DC2626]/10 rounded-lg flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-[#DC2626]" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Emergency Alerts
              </h3>
              <p className="text-gray-600">
                Receive immediate notifications for urgent blood requirements in your vicinity.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white border border-red-100 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-[#DC2626]/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-[#DC2626]" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Community Impact
              </h3>
              <p className="text-gray-600">
                Join thousands of donors making a difference in their communities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-red-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-white border border-red-100 shadow-sm">
              <div className="flex flex-col items-center">
                <Heart className="h-8 w-8 text-[#DC2626] mb-2" />
                <p className="text-gray-600 text-sm">Lives Saved</p>
                <p className="text-2xl font-bold text-gray-900">5,678+</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white border border-red-100 shadow-sm">
              <div className="flex flex-col items-center">
                <Users className="h-8 w-8 text-[#DC2626] mb-2" />
                <p className="text-gray-600 text-sm">Active Donors</p>
                <p className="text-2xl font-bold text-gray-900">1,234+</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white border border-red-100 shadow-sm">
              <div className="flex flex-col items-center">
                <Bell className="h-8 w-8 text-[#DC2626] mb-2" />
                <p className="text-gray-600 text-sm">Hospitals</p>
                <p className="text-2xl font-bold text-gray-900">348+</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white border border-red-100 shadow-sm">
              <div className="flex flex-col items-center">
                <Droplet className="h-8 w-8 text-[#DC2626] mb-2" />
                <p className="text-gray-600 text-sm">Blood Units</p>
                <p className="text-2xl font-bold text-gray-900">9,846+</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to Make a Difference?
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
            Every donation counts. Join our community today and help save lives.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/auth/login')}
              className="px-8 py-4 rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] transition-colors"
            >
              Get Started
            </button>
            <button
              onClick={() => router.push('/about')}
              className="px-8 py-4 rounded-lg bg-transparent border border-[#DC2626] text-[#DC2626] font-semibold hover:bg-[#DC2626]/10 transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}