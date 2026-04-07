const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

let statusBarItems = {};
let refreshInterval;

function activate(context) {
    console.log('PM2 Process Manager extension activated');

    const config = vscode.workspace.getConfiguration('vscode-pm2');
    const processNames = config.get('processNames') || ['local.dev', 'local.prod'];
    const refreshIntervalMs = config.get('refreshInterval') || 5000;

    // Check if PM2 is available
    exec('pm2 --version', (error) => {
        if (error) {
            vscode.window.showErrorMessage('PM2 is not installed or not in PATH. Please install PM2 globally: npm install -g pm2');
        }
    });

    // Create status bar items for each process
    processNames.forEach(processName => {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = `$(loading~spin) ${processName}`;
        statusBarItem.tooltip = `PM2 process: ${processName}`;
        statusBarItem.command = `vscode-pm2.${processName}.menu`;
        statusBarItem.show();
        statusBarItems[processName] = statusBarItem;

        // Register command for context menu
        const commandName = `vscode-pm2.${processName}.menu`;
        const command = vscode.commands.registerCommand(commandName, () => {
            showProcessMenu(processName);
        });
        context.subscriptions.push(command);
    });

    // Register global commands
    const refreshCommand = vscode.commands.registerCommand('vscode-pm2.refresh', () => {
        refreshAllProcesses();
    });
    context.subscriptions.push(refreshCommand);

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
}

async function refreshAllProcesses() {
    const config = vscode.workspace.getConfiguration('vscode-pm2');
    const processNames = config.get('processNames') || ['local.dev', 'local.prod'];

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
    const config = vscode.workspace.getConfiguration('vscode-pm2');
    const maxLines = config.get('logsMaxLines') || 100;

    exec(`pm2 logs ${processName} --lines ${maxLines} --nostream`, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to get logs for ${processName}: ${error.message}`);
            return;
        }

        const outputChannel = vscode.window.createOutputChannel(`PM2 Logs: ${processName}`);
        outputChannel.clear();
        outputChannel.append(stdout || stderr);
        outputChannel.show();
    });
}

module.exports = {
    activate,
    deactivate
};