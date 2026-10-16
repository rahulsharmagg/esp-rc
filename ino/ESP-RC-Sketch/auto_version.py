import re
import os
import sys

# Locate version.h dynamically relative to the script location
script_dir = os.path.dirname(os.path.realpath(__file__))
version_file = os.path.join(script_dir, 'Version.h')

if not os.path.exists(version_file):
    sys.exit(0) # Exit silently if the file isn't created yet

with open(version_file, 'r') as file:
    content = file.read()

# Increment build number
match = re.search(r'#define BUILD_NUMBER\s+(\d+)', content)
if match:
    new_build = int(match.group(1)) + 1
    content = re.sub(r'#define BUILD_NUMBER\s+\d+', f'#define BUILD_NUMBER {new_build}', content)
    
    # Auto-update patch number inside the semantic version string
    content = re.sub(r'#define FIRMWARE_VERSION\s+"(\d+\.\d+\.)(\d+)"', lambda m: f'#define FIRMWARE_VERSION "{m.group(1)}{new_build}"', content)

    ver_match = re.search(r'#define FIRMWARE_VERSION\s+"([^"]+)"', content)
    ver_str = ver_match.group(1) if ver_match else f"Build {new_build}"
    print(f"[AUTO-VERSION] Updated Version.h -> FIRMWARE_VERSION=\"{ver_str}\", BUILD_NUMBER={new_build}")

with open(version_file, 'w') as file:
    file.write(content)