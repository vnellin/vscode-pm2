const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

let statusBarItems = {};
let refreshInterval;
let extensionContext;
let currentProcessNames = [];
let commandDisposables = {};

function activate(context) {
    console.log('PM2 Process Manager extension activated');

    const config = vscode.workspace.getConfiguration('pm2-status');
    const processNames = config.get('processNames') || [];
    const refreshIntervalMs = config.get('refreshInterval') || 5000;
    extensionContext = context;
    currentProcessNames = processNames.slice();

    // Check if PM2 is available
    exec('pm2 --version', (error) => {
        if (error) {
            vscode.window.showErrorMessage('PM2 is not installed or not in PATH. Please install PM2 globally: npm install -g pm2');
        }
    });

    // Create status bar items for each process
    processNames.forEach(processName => {
        createStatusBarItemAndCommand(processName);
    });

    // Register global commands
    const refreshCommand = vscode.commands.registerCommand('pm2-status.refresh', () => {
        refreshAllProcesses();
    });
    context.subscriptions.push(refreshCommand);

    const logsCommand = vscode.commands.registerCommand('pm2-status.logs', async () => {
        const config = vscode.workspace.getConfiguration('pm2-status');
    const processNames = config.get('processNames') || [];
        if (processNames.length === 0) {
            vscode.window.showErrorMessage('No PM2 processes configured. Please add process names in settings.');
            return;
        }
        let processName;
        if (processNames.length === 1) {
            processName = processNames[0];
        } else {
            const selected = await vscode.window.showQuickPick(processNames, {
                placeHolder: 'Select PM2 process to show logs'
            });
            if (!selected) return;
            processName = selected;
        }
        showLogs(processName);
    });
    context.subscriptions.push(logsCommand);

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('pm2-status')) {
            const newConfig = vscode.workspace.getConfiguration('pm2-status');
            const newProcessNames = newConfig.get('processNames') || [];
            const newRefreshIntervalMs = newConfig.get('refreshInterval') || 5000;
            updateStatusBarItems(newProcessNames, newRefreshIntervalMs);
        }
    });
    context.subscriptions.push(configDisposable);

    // Start periodic refresh
    refreshInterval = setInterval(() => {
        refreshAllProcesses();
    }, refreshIntervalMs);

    // Initial refresh
    refreshAllProcesses();
}

function deactivate() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    Object.values(statusBarItems).forEach(item => item.dispose());
    statusBarItems = {};
    Object.values(commandDisposables).forEach(disposable => disposable.dispose());
    commandDisposables = {};
}

async function refreshAllProcesses() {
    const config = vscode.workspace.getConfiguration('pm2-status');
    const processNames = config.get('processNames') || [];

    for (const processName of processNames) {
        await updateProcessStatus(processName);
    }
}

async function updateProcessStatus(processName) {
    return new Promise((resolve) => {
        exec(`pm2 jlist`, (error, stdout, stderr) => {
            let status = 'unknown';
            let pid = null;

            if (!error && stdout) {
                try {
                    const processes = JSON.parse(stdout);
                    const process = processes.find(p => p.name === processName);
                    if (process) {
                        status = process.pm2_env.status;
                        pid = process.pid;
                    }
                } catch (e) {
                    console.error('Failed to parse pm2 jlist', e);
                }
            }

            const statusBarItem = statusBarItems[processName];
            if (statusBarItem) {
                let icon = '$(circle-outline)';
                let color = undefined;

                switch (status) {
                    case 'online':
                        icon = '$(play)';
                        color = new vscode.ThemeColor('statusBarItem.warningForeground');
                        break;
                    case 'stopped':
                        icon = '$(stop)';
                        color = new vscode.ThemeColor('statusBarItem.errorForeground');
                        break;
                    case 'error':
                        icon = '$(error)';
                        color = new vscode.ThemeColor('statusBarItem.errorForeground');
                        break;
                    default:
                        icon = '$(question)';
                }

                statusBarItem.text = `${icon} ${processName}`;
                statusBarItem.color = color;
                statusBarItem.tooltip = `PM2: ${processName} - ${status}${pid ? ` (PID: ${pid})` : ''}`;
            }

            resolve();
        });
    });
}

function createStatusBarItemAndCommand(processName) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = `$(loading~spin) ${processName}`;
    statusBarItem.tooltip = `PM2 process: ${processName}`;
    statusBarItem.command = `pm2-status.${processName}.menu`;
    statusBarItem.show();
    statusBarItems[processName] = statusBarItem;

    const commandName = `pm2-status.${processName}.menu`;
    const command = vscode.commands.registerCommand(commandName, () => {
        showProcessMenu(processName);
    });
    commandDisposables[processName] = command;
    extensionContext.subscriptions.push(command);
}

function updateStatusBarItems(newProcessNames, newRefreshIntervalMs) {
    // Update process names
    const oldProcessNames = currentProcessNames.slice();
    const toAdd = newProcessNames.filter(name => !oldProcessNames.includes(name));
    const toRemove = oldProcessNames.filter(name => !newProcessNames.includes(name));

    // Remove status bar items for processes no longer in config
    toRemove.forEach(processName => {
        const item = statusBarItems[processName];
        if (item) {
            item.dispose();
            delete statusBarItems[processName];
        }
        const commandDisposable = commandDisposables[processName];
        if (commandDisposable) {
            commandDisposable.dispose();
            delete commandDisposables[processName];
        }
    });

    // Add status bar items for new processes
    toAdd.forEach(processName => {
        createStatusBarItemAndCommand(processName);
    });

    // Update currentProcessNames
    currentProcessNames = newProcessNames.slice();

    // Update refresh interval if changed
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
        refreshAllProcesses();
    }, newRefreshIntervalMs);
}

async function showProcessMenu(processName) {
    const items = [
        { label: 'Start', description: 'Start the process', command: 'start' },
        { label: 'Stop', description: 'Stop the process', command: 'stop' },
        { label: 'Restart', description: 'Restart the process', command: 'restart' },
        { label: 'Logs', description: 'Show logs', command: 'logs' },
        { label: 'Refresh', description: 'Refresh status', command: 'refresh' }
    ];

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: `Select action for ${processName}`
    });

    if (!selection) return;

    switch (selection.command) {
        case 'start':
            execCommand(`pm2 start ${processName}`, processName);
            break;
        case 'stop':
            execCommand(`pm2 stop ${processName}`, processName);
            break;
        case 'restart':
            execCommand(`pm2 restart ${processName}`, processName);
            break;
        case 'logs':
            showLogs(processName);
            break;
        case 'refresh':
            updateProcessStatus(processName);
            break;
    }
}

function execCommand(command, processName) {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to execute command for ${processName}: ${error.message}`);
        } else {
            vscode.window.showInformationMessage(`Command executed for ${processName}`);
            updateProcessStatus(processName);
        }
    });
}

async function showLogs(processName) {
    const terminal = vscode.window.createTerminal(`PM2 Logs: ${processName}`);
    terminal.sendText(`pm2 logs ${processName}`);
    terminal.show();
}

module.exports = {
    activate,
    deactivate
};