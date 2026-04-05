#!/bin/bash

npm run dev 2>&1 | grep --line-buffered -v "watch error"
