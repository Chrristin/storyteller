#!/usr/bin/env python3
"""Make the generated Android project sign its release build with your key.

`expo prebuild` writes android/app/build.gradle with the release build signed
by the public debug key. This swaps in a release signing config that reads the
keystore path, password and alias from environment variables, so the key and
its password never appear in the repository.

Environment: KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS (default "storyteller").
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle"
text = open(path).read()

release_config = """        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASS")
            keyAlias System.getenv("KEY_ALIAS") ?: "storyteller"
            keyPassword System.getenv("KEYSTORE_PASS")
        }
"""

if "signingConfigs.release" in text:
    sys.exit("already patched")

# 1. add a release config next to the debug one
text, n = re.subn(
    r"(signingConfigs \{\n        debug \{.*?\n        \}\n)",
    lambda m: m.group(1) + release_config,
    text,
    count=1,
    flags=re.S,
)
if n != 1:
    sys.exit("could not find the signingConfigs block")

# 2. use it for the release build type (the debug build type keeps the debug key)
text, n = re.subn(
    r"(release \{\n(?:\s*//.*\n)*\s*)signingConfig signingConfigs\.debug",
    r"\1signingConfig signingConfigs.release",
    text,
    count=1,
)
if n != 1:
    sys.exit("could not find the release buildType")

open(path, "w").write(text)
print("release builds will be signed with the key from the environment")
