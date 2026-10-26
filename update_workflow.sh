#!/bin/bash
cat .github/workflows/nexus-factory.yml | sed 's/jobs:/permissions:\n  contents: write\n\njobs:/' > .github/workflows/nexus-factory.yml.tmp
mv .github/workflows/nexus-factory.yml.tmp .github/workflows/nexus-factory.yml
