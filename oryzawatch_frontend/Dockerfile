# Frontend multi-stage build for Vite + React
FROM node:18-alpine AS build

WORKDIR /app

# copy package metadata first for install
COPY package.json package-lock.json* ./

# install deps (dev deps needed for build)
RUN npm install

# copy source and build
COPY . .
RUN npm run build

# Production image
FROM nginx:stable-alpine

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Use custom nginx config to support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
