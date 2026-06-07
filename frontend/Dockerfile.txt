# Use official Node image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json .

# Install dependencies
RUN npm install

# Copy rest of frontend code
COPY . .

# Build the React app
RUN npm run build

# Expose port
EXPOSE 5173

# Start the app
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]