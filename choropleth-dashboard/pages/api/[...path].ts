import { NextApiRequest, NextApiResponse } from 'next';
import httpProxyMiddleware from 'next-http-proxy-middleware';

// Determine the backend URL
const getBackendUrl = () => {
  
  // Check if a direct BACKEND_URL is set
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  
  return 'http://localhost:5001';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const backendUrl = getBackendUrl();
  console.log(`!!!!!! Proxying request to: ${backendUrl} !!!!!! \n`);
  
  try {
    return httpProxyMiddleware(req, res, {
      target: backendUrl,
      pathRewrite: [{ patternStr: `/api(.*)`, replaceStr: '$1' }],
      changeOrigin: true,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Proxy error', details: errorMessage });
  }
}