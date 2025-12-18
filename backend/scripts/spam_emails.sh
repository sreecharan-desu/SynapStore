#!/bin/bash

# Configuration
URL="http://localhost:3000/api/v1/email/send"
EMAIL="nagamohan765@gmail.com"
SUBJECT="Hi Kojja"

echo "Starting to send 100 emails to $EMAIL..."

for i in {1..100}
do
   # Send in background to execute faster (parallel)
   curl -s -X POST "$URL" \
     -H "Content-Type: application/json" \
     -d "{\"email\": \"$EMAIL\", \"subject\": \"$SUBJECT #$i\", \"html\": \"<p>Hi Kojja, this is email number <b>$i</b></p>\"}" > /dev/null &
   
   echo -ne "Sent request $i\r"
   
   # Limit concurrency slightly if needed, or remove for full blast
   if (( $i % 10 == 0 )); then
       sleep 0.1
   fi
done

wait
echo -e "\nAll 100 requests completed."
