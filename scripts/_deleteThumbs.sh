#!/bin/bash

cd "/home/administrator/Television"

find -name "*.png" -exec sh -c '
rm "$0"
#FN=$(echo "$0" | sed -e "s/\(\.mp4\)*$//g");
#echo "$0"
#echo "$FN"
#echo "-----"
' {} \; 



