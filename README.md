

## 📷 dashcam_web

**dashcam_web** is the web frontend for the `dashcam` system. It serves static files and provides a simple HTTP server interface, designed to run either on a Raspberry Pi or a desktop system.

Access the web interace by going to this url on a browser: [http://ip_of_dashcam]()

See also: [Dashcam](https://github.com/fjh32/dashcam)
---

### ⚙️ Requirements

- [Go](https://golang.org/dl/) (version 1.16 or higher recommended)

To check if Go is installed:

```bash
go version
```

If not installed, you can install Go via:

```bash
sudo apt install golang
```

---

### 🚀 Installation

The `install.sh` script will:

- Build the Go executable (`dashcam_web_exe`)
- Install it to `/usr/local/bin`
- Install a `systemd` service (`dashcam_web.service`)
- Copy static web assets to `/var/lib/dashcam/static/`
- Enable and start the service

#### 🐤 Raspberry Pi (ARM) install:

```bash
./install.sh
```

#### 💥 Desktop (x86_64) install:

```bash
./install.sh --desktop
```

---

### 📂 Static Assets

All contents of the `./static/` folder will be installed to:

```
/var/lib/dashcam/static/
```

This is where the web frontend serves its static files from.

---

### 🔧 Systemd Service

The service is named `dashcam_web.service`. After installation, it runs automatically in the background.

Check status:

```bash
sudo systemctl status dashcam_web.service
```

View logs:

```bash
journalctl -u dashcam_web.service -f
```

---