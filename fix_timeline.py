with open('src/components/Timeline.tsx', 'r') as f:
    lines = f.readlines()

lines.insert(2752, "                            )}\n")
with open('src/components/Timeline.tsx', 'w') as f:
    f.writelines(lines)
