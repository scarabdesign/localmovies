#!/bin/bash

cd "/home/administrator/Television"
#cd "/home/administrator/Television/30 Rock/Season 1/"

find -name "*.mp4" -exec sh -c '
SEARCH="mpeg4";
E1=".";
TYPE=$(mplayer -quiet -vo null -ao null -identify -frames 0 "$0" 2>/dev/null | grep "$SEARCH"); 
case "$TYPE" in 
	*$SEARCH*)
		
		FN=$(echo $0 | sed -e "s/\(\.mp4\)*$//g");
		FNR="${FN}._mp4"
		
		echo "Renaming: ${FNR}" >>/home/administrator/Documents/logCov.log 2>&1
		mv "$0" "$FNR" 

		echo "Convert: $0" >>/home/administrator/Documents/logCov.log 2>&1
		avconv -i "$FNR" -c:v h264 -c:a copy "$0" >>/home/administrator/Documents/logCov.log 2>&1
	;;
esac
' {} \; &
