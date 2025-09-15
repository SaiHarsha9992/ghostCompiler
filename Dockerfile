# Use Node 18 as base
FROM node:18

# Install compilers
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    g++ gcc \
    openjdk-17-jdk \
    && apt-get clean

# Make `python` command available
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install

# Copy app code
COPY . .

# Expose port
EXPOSE 8080

# Start server + worker
CMD ["npm", "start"]
