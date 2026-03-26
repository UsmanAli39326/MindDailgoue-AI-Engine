# Use a stable, lightweight Node.js image
FROM node:20-slim

# Create and set the working directory
WORKDIR /app

# Copy the dependency files first for efficient caching
COPY package*.json ./

# Install only production dependencies to keep the image small
RUN npm install --omit=dev

# Copy the rest of the source code
# Note: .dockerignore will handle things like node_modules/ and .env.local
COPY . .

# Expose the API port (as defined in server.js)
EXPOSE 8000

# Metadata (optional but helpful)
ENV NODE_ENV=production

# Start the MindDialogue API
CMD [ "npm", "start" ]
