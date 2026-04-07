# PM2 Process Manager for VS Code

This extension allows you to monitor and manage PM2 processes directly from VS Code status bar.

## Features

- Display PM2 process status in status bar
- Start, stop, restart processes via context menu
- View logs in output channel
- Configurable process names
- Automatic refresh interval

## Configuration

Extension settings:

- `vscode-pm2.processNames`: Array of PM2 process names to monitor (default: `["local.dev", "local.prod"]`)
- `vscode-pm2.refreshInterval`: Refresh interval in milliseconds (default: `5000`)
- `vscode-pm2.logsMaxLines`: Maximum lines to show in logs (default: `100`)

## Usage

1. Install the extension
2. Ensure PM2 is installed globally (`npm install -g pm2`)
3. Configure process names in VS Code settings
4. Status bar will show process status with icons
5. Click on status bar item to open action menu

## Commands

- `PM2: Refresh processes` - Refresh all processes
- `PM2: Start process` - Start selected process
- `PM2: Stop process` - Stop selected process
- `PM2: Restart process` - Restart selected process
- `PM2: Show logs` - Show logs for selected process

## Status Bar Icons

- $(play): Process is online
- $(stop): Process is stopped
- $(error): Process in error state
- $(question): Unknown status

## Development

1. Clone repository
2. Run `npm install`
3. Open in VS Code
4. Press F5 to launch extension development host

## License

MIT