#!/bin/bash

# Stop script execution if any command fails
set -e;

sed 's/=.*/=/' .env > env.example