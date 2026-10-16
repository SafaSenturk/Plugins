#!/usr/bin/env bash
# usage: gfont.sh "Family Name" FilePrefix outdir "400;500;600;700"
fam="$1"; pre="$2"; out="$3"; w="${4:-400;500;600;700;800}"
q=$(echo "$fam" | tr ' ' '+')
mkdir -p "$out"
curl -s "https://fonts.googleapis.com/css2?family=$q:wght@$w" | tr -d '\n' | grep -o "font-weight: [0-9]*;  src: url([^)]*)" | while read -r _ wt _ url; do
  wt=${wt%;}; url=${url#url(}; url=${url%)}
  curl -s -o "$out/$pre-$wt.ttf" "$url" && echo "$out/$pre-$wt.ttf"
done
