import { z } from "zod";

export const onboardingSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  industry: z.string().min(1, "Industry is required"),
  website: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional(),
  companyDescription: z.string().max(500).optional(),

  productName: z.string().min(1, "Product name is required"),
  productDescription: z.string().min(1, "Product description is required").max(500),
  problemSolved: z.string().optional(),
  targetMarket: z.string().optional(),
  targetCity: z.string().optional(),
  differentiators: z.string().max(300).optional(),

  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  mobileCountryCode: z.string().min(1),
  mobileNumber: z.string().min(1, "Mobile number is required"),
  workEmail: z.string().min(1, "Work email is required").email("Enter a valid email address"),
  jobTitle: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export const stepFields: Record<number, (keyof OnboardingFormValues)[]> = {
  0: ["companyName", "industry", "country", "city", "companyDescription", "productName", "productDescription", "problemSolved", "targetMarket", "targetCity", "differentiators"],
  1: ["firstName", "lastName", "mobileCountryCode", "mobileNumber", "workEmail", "jobTitle"],
  2: [],
};
