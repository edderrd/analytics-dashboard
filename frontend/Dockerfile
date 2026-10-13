# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
RUN npm install --workspace frontend --include-workspace-root
COPY frontend ./frontend
RUN npm run build --workspace frontend

# ---- runtime stage ----
FROM nginx:alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]