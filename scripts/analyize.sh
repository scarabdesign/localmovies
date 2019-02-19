#!/bin/bash

mplayer -quiet -vo null -ao null -identify -frames 0 "$1" 
#2>/dev/null

