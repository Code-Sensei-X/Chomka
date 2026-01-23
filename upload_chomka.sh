#!/bin/bash

# 1. Navigate to the specific Chomka project directory
# We use quotes to handle the spaces and '!' in the path safely
PROJECT_PATH="/d/Projects/! Antigravity Projects/chomka"

echo "----------------------------------------"
echo "Navigating to: $PROJECT_PATH"
echo "----------------------------------------"

cd "$PROJECT_PATH" || { echo "❌ Error: Could not find directory. Check the path."; exit 1; }

# 2. Check if Git is initialized
if [ ! -d ".git" ]; then
    echo "⚙️  Initializing new Git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository already active."
fi

# 3. Check if a remote URL (GitHub) is connected
REMOTE_URL=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE_URL" ]; then
    echo "⚠️  No GitHub repository linked."
    echo "Please paste your GitHub Repository URL (ending in .git) and press Enter:"
    read -r NEW_URL
    if [ -n "$NEW_URL" ]; then
        git remote add origin "$NEW_URL"
        echo "🔗 Linked to $NEW_URL"
    else
        echo "❌ Error: No URL provided. Exiting."
        exit 1
    fi
fi

# 4. Add and Commit files
echo "📦 Adding files..."
git add .

echo "📝 Enter your commit message (e.g., 'Update browser features'):"
read -r COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Auto-update $(date +'%Y-%m-%d %H:%M')"
    echo "No message entered. Using default: $COMMIT_MSG"
fi

git commit -m "$COMMIT_MSG"

# 5. Push to GitHub
echo "🚀 Uploading to GitHub..."
git push -u origin main

echo "----------------------------------------"
echo "✅ Upload complete!"
read -p "Press Enter to close..."