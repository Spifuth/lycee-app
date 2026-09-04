FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# The privacy gate runs inside the image build, not only in CI. Images are built
# locally with build.sh on the deployment host, which never passes through
# GitHub Actions — so this is the only checkpoint every shipped image is
# guaranteed to cross. It has already caught a generated bundle beaconing to
# Vercel from a site that serves minors.
RUN npm run check:no-external-origins

FROM nginx:alpine
COPY --from=build /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/ >/dev/null || exit 1
