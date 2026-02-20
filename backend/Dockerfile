# Use a lightweight, official Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8081

CMD ["npx", "ts-node", "main.ts"]
