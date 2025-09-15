# Base Node.js image
FROM node:18

# Install compilers/interpreters
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    g++ gcc \
    openjdk-17-jdk \
    nodejs npm \
    && apt-get clean

WORKDIR /app

# Copy app files
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
