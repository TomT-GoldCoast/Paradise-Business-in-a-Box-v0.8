PARADISE BACKUP COMPANION

Purpose:
- The hosted application keeps running even when this Windows PC is off.
- When this PC starts and the companion runs, it downloads the newest hosted full backup.
- If no backup folder has been configured, first run asks the Owner to choose one or more folders/drives.
- Missing external drives do not block backups to available destinations.

Setup:
1. In the hosted app, sign in as Owner and open Backup & Restore.
2. Create a Backup Device Key.
3. Run START-BACKUP-COMPANION.bat.
4. Enter the hosted site address, Device Key, and one or more local backup folders.
5. Add START-BACKUP-COMPANION.bat to Windows startup/Task Scheduler after the production computer is available.

Security:
- Device keys are stored hashed on the server. The plaintext key is shown only when created.
- Keep backup-companion.config.json private because it contains the device key used by this computer.
