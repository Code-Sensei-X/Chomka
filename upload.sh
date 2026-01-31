# 1. Navigate to your project folder
# Note: Use forward slashes and quotes because of the spaces/special characters in your path
cd "D:/Projects/! Antigravity Projects/Chomka_14"

# 2. Initialize a new Git repository (if not already done)
git init

# 3. Add all files in the directory to the staging area
git add .

# 4. Commit the files
git commit -m "Upload Chomka_14 version"

# 5. Rename the local branch to main (GitHub's default)
git branch -M main

# 6. Add the remote origin
# If the origin already exists, use: git remote set-url origin [URL]
git remote add origin https://github.com/Code-Sensei-X/Chomka_WebOS-v1.14d.git

# 7. Push the files to GitHub
# The -f (force) flag will overwrite existing files on GitHub with your local files
git push -u origin main --force