import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    BACKEND_URL: process.env.BACKEND_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
}