const { sep } = require('path');
const path = require('path');
const { exec } = require('child_process');
const { existsSync } = require('fs');
const { get } = require('http');
const httpGet = get;
const fs = require('fs');
const tools = require('@tizentv/tools');

const sdkToolTmp = `/home/owner/share/tmp/sdk_tools/tmp/`;
const emulatorDev = `emulator-26101`;
const portRegExp = /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;

class AppLauncher {
    constructor(props) {
        this.projectPath = props.projectPath;
        this.debugMode = props.debugMode;
        this.device = props.device == 'emulator' ? emulatorDev : props.device;
        this.pkgName = props.appID.split('.')[1];
        this.pkgID = props.appID.split('.')[0];
        this.wgtFile = path.resolve(this.projectPath, `${this.pkgName}.wgt`);
        this.debugPort = null;
        this.chromeExec = null;
    }

    _execAsync(cmd, outCheck) {
        return new Promise(function(resolve, reject) {
            console.log(`[webide-common-tizentv]AppLauncher._execAsync: ${cmd}`);
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    reject(`${err.name}: ${err.message}`);
                }
                else {
                    if (outCheck) {
                        outCheck(stdout, resolve, reject);
                    }
                    else {
                        resolve();
                    }
                }
            });
        });
    }

    async checkEmulator() {
        let sdbExec = await tools.getSdbPath();
        console.info('sdbExec = ' + sdbExec);
        try {
            fs.accessSync(sdbExec, fs.constants.S_IXUSR);
        } catch(err) {
            fs.chmodSync(sdbExec, fs.constants.S_IRWXU|fs.constants.S_IRWXG)
        }

        return this._execAsync(`${sdbExec} --emulator devices`, function(stdout, resolve, reject) {
            if (stdout.includes(emulatorDev)) {
                resolve();
            }
            else {
                console.error('[webide-common-tizentv]AppLauncher.checkEmulator:  No running emulator device.');
                reject(`EnvError: No running emulator device.`);
            }
        }.bind(this))
    }

    checkChrome(chromeExecPath) {
        //this.chromeExec = vscode.workspace.getConfiguration('tizentv')['chromeExecutable'];
        if (existsSync(chromeExecPath)) {
            //if (process.platform == 'win32') {
                this.chromeExec = `"${this.chromeExec}"`;
            //}
            return Promise.resolve();
        }

        console.error('[webide-common-tizentv]AppLauncher.checkChrome: Chrome executable file is not configured.');
        return Promise.reject(`EnvError: Chrome executable file is not configured.`);
    }

    async pushWgt() {
        let sdbExec = await tools.getSdbPath();
        if (!existsSync(this.wgtFile)) {
            console.error('[webide-common-tizentv]AppLauncher.pushWgt: ' + this.wgtFile + ' is not exist');
            reject(this.wgtFile + ' is not exist');
        }
        return this._execAsync(`${sdbExec} -s ${this.device} push ${this.wgtFile} ${sdkToolTmp}`);
    }

    async installApp() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} -s ${this.device} shell 0 vd_appinstall  ${this.pkgID}.${this.pkgName} ${sdkToolTmp}${this.pkgName}.wgt`);
    }

    async uninstallApp() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} -s ${this.device} shell 0 vd_appuninstall ${this.pkgID}.${this.pkgName}`);
    }

    async executeApp() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} -s ${this.device} shell 0 execute ${this.pkgID}.${this.pkgName}`);
    }

    async debugApp() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} -s ${this.device} shell 0 debug ${this.pkgID}.${this.pkgName}`, (stdout, resolve, reject) => {
            // For debug mode stdout: ... successfully launched pid = xxxx with debug 1 port: xxxxx
            if (stdout.includes(`successfully launched`) && stdout.includes(`port:`)) {
                this.debugPort = stdout.split(' ').pop();

                let portN = this.debugPort.indexOf('\n');
                let portR = this.debugPort.indexOf('\r');
                if (portN || portR) {
                    this.debugPort = this.debugPort.substring(0, portN < portR ? portN : portR);
                }

                resolve();
            }
            else {
                reject(`error: ${stdout}`);
            }
        })
    }

    async setDebugPort() {
        let sdbExec = await tools.getSdbPath();
        if (portRegExp.test(this.debugPort)) {
            return this._execAsync(`${sdbExec} -s ${this.device} forward tcp:7011 tcp:${this.debugPort}`);
        }

        return Promise.reject(`Error: Invalid debug port: ${this.debugPort}`);
    }

    async rmRemoteFile() {
        let sdbExec = await tools.getSdbPath();
        // Remove remote files: /home/owner/share/tmp/sdk_tools/tmp/*.wgt
        return this._execAsync(`${sdbExec} -s ${this.device} shell 0 rmfile`);
    }

    openChromeDevTool(chromeExecPath) {
        let ipAddr = this.device.includes('emulator') ? '127.0.0.1' : this.device;
        let port = this.device.includes('emulator') ? '7011' : this.debugPort;
        httpGet(`http://${ipAddr}:${port}/json`, (res) => {
            let weJson = '';

            if (res.statusCode != 200) {
                return;
            }

            res.on('data', (chunk) => { weJson += chunk; });
            res.on('end', () => {
                let devUrl = JSON.parse(weJson)[0].devtoolsFrontendUrl;//.replace('(','\\(').replace(')','\\)');
                if (process.platform == 'linux' || process.platform == 'darwin') {
                    devUrl = devUrl.replace('(','\\(').replace(')','\\)');
                }

                if (process.platform == 'win32' || process.platform == 'darwin') {
                    this._execAsync(`"${chromeExecPath}" --new-window --enable-blink-features=ShadowDOMV0,CustomElementsV0,HTMLImports http://${ipAddr}:${port}${devUrl}`);
                } else {
                    this._execAsync(`${chromeExecPath} --new-window --enable-blink-features=ShadowDOMV0,CustomElementsV0,HTMLImports http://${ipAddr}:${port}${devUrl}`);
                }
            })
        })
    }

    async connectTarget() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} connect ${this.device}`);
    }

    async disconnectTarget() {
        let sdbExec = await tools.getSdbPath();
        return this._execAsync(`${sdbExec} disconnect ${this.device}`);
    }
}
exports.AppLauncher = AppLauncher;
