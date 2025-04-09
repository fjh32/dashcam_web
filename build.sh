#!/bin/bash
GOARCH=arm GOARM=6 go build
./network_perms.sh