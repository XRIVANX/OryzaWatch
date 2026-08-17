# Expo dev server in a container
FROM node:18-alpine

WORKDIR /app

# build tools that some native deps may need at install time
RUN apk add --no-cache python3 make g++ git

# copy metadata and install
COPY package.json package-lock.json* ./

# install expo-cli globally and project deps
RUN npm install -g expo-cli && npm install

# copy app source
COPY . .

# ensure expo devtools listen on all interfaces
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

# common Expo ports (dev server, devtools, metro)
EXPOSE 19000 19001 8081

# keep container running and start expo
CMD ["npm", "start"]
