#!/bin/bash
if ! grep -q "permissions:" .github/workflows/nexus-factory.yml; then
  sed 's/jobs:/permissions:
  contents: write

jobs:/' .github/workflows/nexus-factory.yml > .github/workflows/nexus-factory.yml.tmp
  mv .github/workflows/nexus-factory.yml.tmp .github/workflows/nexus-factory.yml
fi
