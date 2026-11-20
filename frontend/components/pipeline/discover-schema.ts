import { z } from "zod";

// Used by the "New product" wizard (app/[locale]/(app)/products/new) to
// call POST /api/v1/pipeline/discover -- see lib/api-client/pipeline.ts.
export const discoverSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  productDescription: z
    .string()
    .min(20, "Describe the product in at least 20 characters so Agent 1 can identify a buyer")
    .max(1000),
  senderName: z.string().min(1, "Your name is required"),
  senderCompanyName: z.string().min(1, "Company name is required"),
  senderEmail: z.string().min(1, "Email is required").email("Enter a valid email address"),
  senderPhone: z.string().min(1, "Phone number is required"),
  preferredCity: z.string().optional(),
  requestedCompanyCount: z.coerce.number().int().min(1).max(50).optional(),
});

export type DiscoverFormValues = z.infer<typeof discoverSchema>;
