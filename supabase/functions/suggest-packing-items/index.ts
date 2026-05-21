// Supabase Edge Function: suggest-packing-items
// Deploy with: supabase functions deploy suggest-packing-items

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  destination?: string;
  start_date?: string;
  end_date?: string;
  stop_types?: string[];
}

interface PackingItem {
  label: string;
  category: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { destination, start_date, end_date, stop_types = [] } = body;

    // Calculate trip duration
    const days = start_date && end_date
      ? Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86400000)
      : 7;

    const suggestions: PackingItem[] = [
      // Documents
      { label: "Passport", category: "Documents" },
      { label: "Travel Insurance", category: "Documents" },
      { label: "Visa / E-visa", category: "Documents" },
      { label: "Flight Tickets (printout)", category: "Documents" },
      { label: "Hotel Confirmations", category: "Documents" },
      // Electronics
      { label: "Phone Charger", category: "Electronics" },
      { label: "Universal Adapter", category: "Electronics" },
      { label: "Power Bank", category: "Electronics" },
      { label: "Camera", category: "Electronics" },
      { label: "Earphones / Headphones", category: "Electronics" },
      // Clothing
      { label: `T-Shirts (${days})`, category: "Clothing" },
      { label: "Underwear & Socks", category: "Clothing" },
      { label: "Comfortable Walking Shoes", category: "Clothing" },
      { label: "Light Jacket / Hoodie", category: "Clothing" },
      { label: "Formal Outfit", category: "Clothing" },
      // Toiletries
      { label: "Toothbrush & Toothpaste", category: "Toiletries" },
      { label: "Shampoo & Conditioner", category: "Toiletries" },
      { label: "Sunscreen SPF 50+", category: "Toiletries" },
      { label: "Deodorant", category: "Toiletries" },
      { label: "Razor / Shaver", category: "Toiletries" },
      // Health
      { label: "Paracetamol / Pain Reliever", category: "Health" },
      { label: "Antidiarrheal Medicine", category: "Health" },
      { label: "Bandages & First Aid", category: "Health" },
      { label: "Hand Sanitizer", category: "Health" },
      { label: "Face Mask (N95)", category: "Health" },
      // Convenience
      { label: "Travel Pillow", category: "Convenience" },
      { label: "Reusable Water Bottle", category: "Convenience" },
      { label: "Snacks for Journey", category: "Convenience" },
      { label: "Packing Cubes", category: "Convenience" },
      { label: "Laundry Bag", category: "Convenience" },
    ];

    // Add destination-specific items
    if (destination) {
      const dest = destination.toLowerCase();
      if (dest.includes("japan") || dest.includes("tokyo") || dest.includes("osaka")) {
        suggestions.push(
          { label: "IC Card (Suica/Pasmo)", category: "Transport" },
          { label: "Pocket WiFi / SIM Card", category: "Electronics" },
          { label: "Cash (JPY)", category: "Documents" },
          { label: "Hand Towel (for onsen)", category: "Toiletries" }
        );
      }
      if (dest.includes("beach") || dest.includes("palawan") || dest.includes("bali") || dest.includes("phuket")) {
        suggestions.push(
          { label: "Swimsuit / Bikini", category: "Clothing" },
          { label: "Beach Towel", category: "Convenience" },
          { label: "Waterproof Bag", category: "Convenience" },
          { label: "Flip Flops / Sandals", category: "Clothing" },
          { label: "Reef-safe Sunscreen", category: "Toiletries" }
        );
      }
    }

    // Add flight-specific items
    if (stop_types.includes("flight")) {
      suggestions.push(
        { label: "Neck Pillow", category: "Convenience" },
        { label: "Eye Mask", category: "Convenience" },
        { label: "Compression Socks", category: "Health" }
      );
    }

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
