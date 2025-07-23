#!/bin/bash

for patch in ???-*.patch; do
    if [ -f "$patch" ]; then
        # Check if patch can be applied (skip silently if not)
        if git apply --check "$patch" 2>/dev/null; then
            echo "Found applicable patch: $patch"
            echo -n "Apply this patch? (y/n/s/q): "
            read -r response
            
            case "$response" in
                y|Y|yes|Yes)
                    echo "Applying $patch..."
                    if git apply "$patch"; then
                        echo "✓ Successfully applied $patch"
                    else
                        echo "✗ Failed to apply $patch"
                    fi
                    ;;
                s|S|skip)
                    echo "Skipping $patch"
                    ;;
                q|Q|quit)
                    echo "Quitting..."
                    exit 0
                    ;;
                *)
                    echo "Skipping $patch (default)"
                    ;;
            esac
            echo
        fi
        # If patch can't be applied, do nothing (silent skip)
    fi
done