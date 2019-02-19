#!/bin/bash

cd "/home/administrator/Television"

find -name "*.mp4" -exec sh -c '
FN=$(echo "$0" | sed -e "s/\(\.mp4\)*$//g");
ffmpegthumbnailer -i "$0" -o "$FN.png" -c png -s 256
' {} \; &



