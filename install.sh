#!/bin/bash
set -e

# Use logname to get the non-root user who ran sudo, fallback to $USER
USER_NAME=$(logname 2>/dev/null || echo $USER)
SERVICE_NAME="dashcam_web.service"
SERVICE_TEMPLATE="dashcam_web.service.template"
INSTALL_PATH="/usr/local/bin/dashcam_web_exe"
STATIC_DIR="/var/lib/dashcam/static"
SUDOERS_FILE="/etc/sudoers.d/dashcam_restart"

# Check for --desktop flag
if [[ "$1" == "--desktop" ]]; then
    echo "🖥️  Building for desktop (x86_64)..."
    GOARCH=amd64 go build -o dashcam_web_exe
else
    echo "📦 Building for ARM (GOARCH=arm, GOARM=6)..."
    GOARCH=arm GOARM=6 go build -o dashcam_web_exe
fi

echo "📂 Installing binary to $INSTALL_PATH..."
sudo systemctl stop "$SERVICE_NAME" || true
sudo cp dashcam_web_exe "$INSTALL_PATH"
sudo chmod +x "$INSTALL_PATH"
echo "🔧 Applying network permissions to binary..."
sudo setcap 'cap_net_bind_service=+ep' $INSTALL_PATH

echo "📝 Generating and installing systemd service file..."
sudo sed "s|@USER@|$USER_NAME|g" "$SERVICE_TEMPLATE" | sudo tee "/etc/systemd/system/$SERVICE_NAME" > /dev/null

echo "📁 Ensuring static directory exists at $STATIC_DIR..."
if [ ! -d "$STATIC_DIR" ]; then
    echo "Creating directory $STATIC_DIR..."
    sudo mkdir -p "$STATIC_DIR"
    sudo chown "$USER_NAME:$USER_NAME" "$STATIC_DIR"
fi

echo "📥 Copying static assets to $STATIC_DIR..."
sudo cp -r ./static/* "$STATIC_DIR/" || true

echo "🔄 Reloading and enabling systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "🔐 Granting $USER_NAME permission to restart dashcam.service via sudo..."
echo "$USER_NAME ALL=(ALL) NOPASSWD: /bin/systemctl restart dashcam.service" | sudo tee "$SUDOERS_FILE" > /dev/null
echo "$USER_NAME ALL=(ALL) NOPASSWD: /bin/systemctl stop dashcam.service" | sudo tee "$SUDOERS_FILE" > /dev/null
sudo chmod 440 "$SUDOERS_FILE"

echo
echo "✅ dashcam_web_exe installation complete!"
echo "View status with: sudo systemctl status $SERVICE_NAME"
