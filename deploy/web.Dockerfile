# Frontend AeroProce: build bằng Node, chạy bằng Caddy (trang tĩnh + chuyển /api sang backend).
# Build context là thư mục gốc repo (cần cả Front-End lẫn packages/core).
FROM node:22-alpine AS build
WORKDIR /app
COPY packages/core packages/core
COPY Front-End/package.json Front-End/package-lock.json Front-End/
RUN cd Front-End && npm ci --no-audit --no-fund
COPY Front-End Front-End
# Theo dõi lỗi (tuỳ chọn); trống thì bản build không chứa Sentry
ARG VITE_SENTRY_DSN=
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN VITE_SENTRY_ENVIRONMENT=production
# Không đặt VITE_API_BASE_URL: trang gọi /api cùng địa chỉ, không cần CORS
RUN cd Front-End && npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/Front-End/dist /srv
