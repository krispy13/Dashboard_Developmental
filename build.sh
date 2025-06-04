#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting build process..."

# Navigate to the frontend directory
cd choropleth-dashboard

# Install Node.js dependencies
echo "Installing dependencies..."
yarn install

# Build the Next.js application
echo "Building Next.js app..."
yarn build

echo "Build completed successfully!"