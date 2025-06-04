// apiService.js - Frontend API client

// Use Next.js API route to proxy requests to the backend
// This will work regardless of environment (development or production)
const API_BASE_URL = '/api';

export const getHistogramData = async (patternId = 29) => {
  try {
    const response = await fetch(`${API_BASE_URL}/histogram?pattern=${patternId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch histogram data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching histogram data:', error);
    throw error;
  }
};

// Other API functions remain the same, using the /api prefix
// This prefix will be handled by our Next.js API route

export const getConstraints = async (patternId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/constraints?ID=${patternId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch constraints data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching constraints:', error);
    throw error;
  }
};

export const filterGeomap = async (constraints, law) => {
  try {
    const response = await fetch(`${API_BASE_URL}/geomapFilter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ constraints, law }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to filter geomap');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error filtering geomap:', error);
    throw error;
  }
};

export const getUserPattern = async (constraints, law) => {
  try {
    const response = await fetch(`${API_BASE_URL}/userPattern`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ constraints, law }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process user pattern');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error processing user pattern:', error);
    throw error;
  }
};