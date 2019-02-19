#!/bin/bash

cd "/home/administrator/Television"
find -name "*.mkv" -exec sh -c '
echo "Convert: $0" >>/home/administrator/Documents/logCov.log 2>&1
avconv -i "$0" -c:v h264 -c:a copy "$0".mp4 >>/home/administrator/Documents/logCov.log 2>&1
' {} \; &
