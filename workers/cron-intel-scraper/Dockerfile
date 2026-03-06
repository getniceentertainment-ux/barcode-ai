# Use a highly optimized, tiny Python image
FROM python:3.10-alpine

# Install build dependencies for BeautifulSoup
RUN apk add --no-cache build-base

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the scanner script
COPY news_scanner.py .

# Create the cron job file
# This runs the script at minute 0 past every hour (e.g., 1:00, 2:00, 3:00)
RUN echo "0 * * * * python /app/news_scanner.py >> /var/log/cron.log 2>&1" > /etc/crontabs/root

# Create log file
RUN touch /var/log/cron.log

# Run the scanner once on startup, then hand over to crond (the cron daemon)
CMD python /app/news_scanner.py && crond -f -l 2