FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install yarn
RUN apk add --no-cache yarn

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy project files
COPY . .

# Build the app
RUN yarn build

# Install serve globally
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Set the correct working directory
WORKDIR /app/dist

# Start command
CMD ["yarn", "preview", "--host", "0.0.0.0", "--port", "3000"]
