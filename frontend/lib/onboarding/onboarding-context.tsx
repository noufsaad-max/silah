"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "silah_onboarding";

export interface OnboardingData {
  // Company
  companyName: string;
  industry: string;
  website: string;
  country: string;
  city: string;
  companyDescription: string;
  // Product
  productName: string;
  productDescription: string;
  problemSolved: string;
  targetMarket: string;
  targetCity: string;
  differentiators: string;
  // Personal
  firstName: string;
  lastName: string;
  mobileCountryCode: string;
  mobileNumber: string;
  workEmail: string;
  jobTitle: string;
}

export const emptyOnboardingData: OnboardingData = {
  companyName: "",
  industry: "",
  website: "",
  country: "",
  city: "",
  companyDescription: "",
  productName: "",
  productDescription: "",
  problemSolved: "",
  targetMarket: "",
  targetCity: "",
  differentiators: "",
  firstName: "",
  lastName: "",
  mobileCountryCode: "+966",
  mobileNumber: "",
  workEmail: "",
  jobTitle: "",
};

interface OnboardingContextValue {
  data: OnboardingData;
  updateData: (patch: Partial<OnboardingData>) => void;
  step: number;
  setStep: (step: number) => void;
  isHydrated: boolean;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(emptyOnboardingData);
  const [step, setStep] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData({ ...emptyOnboardingData, ...parsed.data });
        setStep(parsed.step ?? 0);
      } catch {
        // ignore corrupt local data, start fresh
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
  }, [data, step, isHydrated]);

  function updateData(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  function reset() {
    setData(emptyOnboardingData);
    setStep(0);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <OnboardingContext.Provider value={{ data, updateData, step, setStep, isHydrated, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
