# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --workspace backend --include-workspace-root
COPY backend ./backend
RUN npm run build --workspace backend

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --workspace backend --include-workspace-root --omit=dev
COPY --from=build /app/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]