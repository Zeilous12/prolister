// app/routes/api.parseSKU.tsx
import type { ActionFunction, LoaderFunction } from "@remix-run/cloudflare";
import { generateData, GetGoogleData, jsonTo2DArray } from "~/lib/skuParser";
declare global {
  interface CloudflareEnvironment {
    GOOGLE_SHEETS_API_KEY: string;
  }
}
export const action: ActionFunction = async ({ request, context }) => {
  try {
    // CORRECT: Access env through context.cloudflare.env
    const env = context.cloudflare.env as { GOOGLE_SHEETS_API_KEY: string };
    const apiKey = env.GOOGLE_SHEETS_API_KEY;
    
    console.log("API Key:", apiKey ? "Available" : "Missing");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SHEETS_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Parse the request body
    let body;
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = { sku: formData.get("sku") };
    } else {
      // Try to parse as text
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { sku: text };
      }
    }

    const { sku } = body as { sku: string };
    
    if (!sku) {
      return new Response("SKU is required", { 
        status: 400,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.log("Processing SKU:", sku.substring(0, 50) + "...");

    // 1. Parse SKU
    const skuInput = sku.toUpperCase().trim();
    const skuList = skuInput
      .split(/[\n,;\t\s]+/)
      .map(s => s.trim())
      .filter(s => s);
    
    // Remove duplicates
    const uniqueSkus = [...new Set(skuList)];

    // 2. Get Sheet Data
    const GoogleData = await GetGoogleData(env);
    if (!GoogleData.data || !Array.isArray(GoogleData.data)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: GoogleData.message || "Failed to fetch sheet data" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Generate CSV
    const Productcsv = await generateData(uniqueSkus, GoogleData.data, env);

    // 4. Return CSV
    return new Response(Productcsv.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="matrixify-import.csv"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error("Failed in API route:", error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// Handle GET requests - return method not allowed
export const loader: LoaderFunction = async () => {
  return new Response(
    JSON.stringify({ 
      error: "Method not allowed. Use POST to submit SKU data." 
    }), {
      status: 405,
      headers: { 
        "Content-Type": "application/json",
        "Allow": "POST" 
      }
    }
  );
};