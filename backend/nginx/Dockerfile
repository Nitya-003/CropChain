FROM nginxinc/nginx-unprivileged:alpine

# Temporarily switch to root to install openssl and set permissions
USER root

# Install openssl for self-signed certificate generation
RUN apk add --no-cache openssl

# Copy configurations
COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Create certs dir, set permissions, and make entrypoint executable
RUN mkdir -p /etc/nginx/certs \
    && chown -R nginx:nginx /etc/nginx/certs \
    && chmod +x /usr/local/bin/entrypoint.sh

# Switch back to non-root user
USER nginx

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
