import type { NextConfig } from "next";

// Determine the backend URL for client-side reference
const getBackendUrl = () => {
  
  // Check if a direct BACKEND_URL is set
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  
  // Fallback for local development
  return 'http://localhost:5001';
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Make the backend URL available to client code
    // But we'll use the API route for actual requests
    BACKEND_URL: getBackendUrl(),
  },
}

export default nextConfig;