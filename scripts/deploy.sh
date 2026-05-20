#!/bin/bash
set -e

echo "Deploying SentinelClear..."

# 1. Update and install dependencies
sudo apt-get update
sudo apt-get install -y docker.io docker-compose ufw

# 2. Firewall configuration
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw --force enable

# 3. Setup environment variables
if [ ! -f .env.production ]; then
    echo "Creating .env.production template. Please edit it before starting."
    cp .env.example .env.production
    exit 1
fi

# 4. Generate SSL Certificate
read -p "Enter your domain name for SSL (e.g. example.com): " DOMAIN
if [ ! -z "$DOMAIN" ]; then
    sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.prod.conf
    # Run certbot standalone to get the cert first time
    docker run -it --rm -p 80:80 -v ${PWD}/certbot/conf:/etc/letsencrypt -v ${PWD}/certbot/www:/var/www/certbot certbot/certbot certonly --standalone -d $DOMAIN
fi

# 5. Build and Deploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

echo "Deployment completed successfully! The system is running in production mode."
