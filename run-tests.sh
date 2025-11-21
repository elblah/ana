#!/bin/bash

bun test

emojis=$(rg '(\p{Emoji_Presentation}|\p{Extended_Pictographic})' | grep -v "[🔴🟢🟡🔵]")
emojis_count=$(wc -l <<< "$emojis")
if [[ -n "$emojis" ]]; then
    echo -e "\n\nIMPORTANT: ${emojis_count} Emojis found... remove all emojis!"
    echo -e "Emojis found:\n${emojis}"
    exit 1
fi
