with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

# find line with "});" immediately before "if (isDragEnd) {"
idx = -1
for i, line in enumerate(lines):
    if "if (isDragEnd) {" in line:
        idx = i
        break

if idx != -1:
    # check lines before idx for extra "});"
    # we expect one `});` for the `setTracks(prev => {` block at the end, but wait...
    # let's look at the lines
    pass

