const fs = require('fs');
const path = require('path');
const readline = require('readline');
const got = require('got');
const hpagent = require('hpagent');
const stream = require('stream');
const {promisify} = require('util');
const decompress = require('decompress');
const npmConf = require('npm-conf')();
const xml2js = require('xml2js');
const utils = require('./utils');

const platform = process.platform == 'win32' ? `windows` : process.platform == 'linux' ? `ubuntu` : 'macos';
const pipeline = promisify(stream.pipeline);

class PackageInfo {
    constructor(url) {
        this._archived = undefined;
        this.rootURL = url;
        this.details = {
            version: '',
            path: '',
            sha256: '',
            size: ''
        };
        this.unknownItems = Object.keys(this.details).length;
        console.log(this.details);
    }

    get archived() { return this._archived; }
    set archived(isArchived) { this._archived = isArchived; }

    get path() { return this.details.path; }
    get version() { return this.details.version; }
    get sha256() { return this.details.sha256; }
    get size() { return this.details.size; }

    collectPkgInfo(info) {
        let entry = info.split(':');
        let prop = entry[0].toLocaleLowerCase().trim();
        let propValue = entry[1].trim();
        if (this.details.hasOwnProperty(prop)) {
            if (this.details[prop] == '' && propValue != '') {
                this.details[prop] = propValue;
                this.unknownItems--;
            }
        }

        if (this.unknownItems == 0) {
            this._archived = true;
        }
    }
}

function getPackageInfo(rootURL, packageName) {
    console.info('[webide-common-tizentv]getPackageInfo(): getPackageInfo start...');
    const bit = process.arch == 'x64' ? '64' : '32';
    const platform = process.platform == 'win32' ? `windows-${bit}` : process.platform == 'linux' ? `ubuntu-${bit}` : 'macos-64';
    let pkgList = rootURL + `/pkg_list_${platform}`;

    return new Promise(async (resolve, reject) => {
        console.info('[webide-common-tizentv]getPackageInfo(): request to: ' + pkgList);
        let userAgent = getUserAgent(pkgList);
        try {
            var pkglistStream = await got.stream(pkgList, userAgent);
        } catch (error) {
            console.error('[webide-common-tizentv]got.stream(): ' + error);
            reject('got.stream failed!');
        }
        let pkgInfo = new PackageInfo(rootURL);
        let rl = readline.createInterface({input: pkglistStream});
        rl.on('line', line => {
            if (pkgInfo.archived) {
                rl.close();
            }

            if (line.includes('Package : ' + packageName)) {
                console.info('[webide-common-tizentv]getPackageInfo(): got package info: ' + line);
                pkgInfo.archived = false;
            }

            if (pkgInfo.archived === false) {
                pkgInfo.collectPkgInfo(line);
            }
        });

        rl.on('close', () => {
            resolve(pkgInfo);
        });
    });
}

function getExtensionPkgInfo(extensionInfoUrl, packageName) {
    console.info('[webide-common-tizentv]getExtensionPkgInfo(): extensionInfoUrl = ' + extensionInfoUrl + ', packageName = ' +  packageName);
    return new Promise(async (resolve, reject) => {
        await downloadPkgFormPath(extensionInfoUrl);
        const pathArr = extensionInfoUrl.split('/');
        const xmlFileName = pathArr[pathArr.length - 1];
        const data = fs.readFileSync(path.resolve(utils.tmpDir, xmlFileName));
        let parser = new xml2js.Parser();
        parser.parseString(data, function (err, result) {
            if (err) {
                console.error('[webide-common-tizentv]getExtensionPkgInfo():' + err);
                reject(err);
            } else {
                let samsungCertExtension = result.extensionSDK.extension.find(extension => {
                    return extension.name == packageName;
                });

                console.info(samsungCertExtension);
                resolve(samsungCertExtension.repository[0].trim());
            }
        });
        fs.unlinkSync(path.resolve(utils.tmpDir, xmlFileName));
    });
}

function getUserAgent(url) {
    console.info('[webide-common-tizentv]getUserAgent(): url = ' + url);
    const pathArr = url.split('/');
    const httpPrefix = pathArr[0];
    let userAgent;
    let userProxy;

    if (httpPrefix == 'https:') {
        userProxy = npmConf.get('https-proxy');
        if (userProxy != undefined && userProxy != '') {
            console.info('[webide-common-tizentv]getPackageInfo():https userProxy = ' + userProxy);
            userAgent = {agent: {https: new hpagent.HttpsProxyAgent({proxy: userProxy})}};
        }
    } else {
        userProxy = npmConf.get('http-proxy');
        if (userProxy != undefined && userProxy != '') {
            console.info('[webide-common-tizentv]getPackageInfo():http userProxy = ' + userProxy);
            userAgent = {agent: {http: new hpagent.HttpProxyAgent({proxy: userProxy})}};
        }
    }

    return userAgent;
}

async function downloadPkg(packageInfo) {
    console.info('[webide-common-tizentv]downloadPkg(): downloadPkg start...');
    await downloadPkgFormPath(packageInfo.rootURL + packageInfo.path);
}

async function downloadPkgFormPath(packagePath) {
    console.info('[webide-common-tizentv]downloadPkg(): downloadPkgFormPath start...');
    if (packagePath == undefined || packagePath == '') {
        console.error('[webide-common-tizentv]downloadPkg(): packagePath is invaild!');
        return;
    }

    if (!fs.existsSync(utils.tmpDir)) {
        fs.mkdirSync(utils.tmpDir);
    }

    const pathArr = packagePath.split('/');
    const pkgName = pathArr[pathArr.length - 1];
    let userAgent = getUserAgent(packagePath);
    try {
        console.log('[webide-common-tizentv]Downloading from ' + packagePath + ' to ' + utils.tmpDir + path.sep + pkgName);
        await pipeline(got.stream(packagePath, userAgent), fs.createWriteStream(utils.tmpDir + path.sep + pkgName));
    } catch (error) {
        console.error('[webide-common-tizentv]got.stream(): ' + error);
    }
}

async function unzipPkgDir(zipFileDir, unzipDir, filterStr) {
    console.info('[webide-common-tizentv]unzipPkgDir(): unzipPkgDir start...');
    if (!fs.existsSync(zipFileDir)) {
        console.warn(`[webide-common-tizentv]unzipPkgDir():No files to unzip.`);
        return;
    }
    let dirent = fs.readdirSync(zipFileDir, {encoding: 'utf8', withFileTypes: false});
    if (dirent.length == 0) {
        console.warn(`[webide-common-tizentv]unzipPkgDir():No files to unzip.`);
        return;
    }

    for(let zipFile of dirent) {
        await unzipPkg(path.resolve(zipFileDir, zipFile), unzipDir, filterStr);
    }
    //fs.rmdirSync(zipFileDir);
}

async function unzipPkg(zipFile, unzipDir, filterStr) {
    console.info('[webide-common-tizentv]unzipPkg(): zipFile = ' + zipFile + ', unzipDir = ' + unzipDir + ', filterStr = ' + filterStr);
    if (!fs.existsSync(zipFile)) {
        console.warn(`[webide-common-tizentv]unzipPkg():No files to unzip.`);
        return;
    }

    await decompress(zipFile, unzipDir, {
        filter: file => file.path.startsWith(filterStr),
        map: file => {
            if (filterStr == undefined || filterStr == '') {
                file.path = file.path.substring(filterStr.length);
            } else {
                file.path = file.path.substring(filterStr.length + 1);
            }
            return file;
        }
    });
    console.info(`[webide-common-tizentv]unzip tool ${zipFile} finish.`);
    fs.unlinkSync(zipFile);
}

async function downloadSamsungCertfile() {
    console.info('[webide-common-tizentv]downloadSamsungCertfile start');
    let samsungCertExtensionUrl = await getExtensionPkgInfo(utils.tizenDownloadUrl + '/extension_info.xml', 'Samsung Certificate Extension');
    await downloadPkgFormPath(samsungCertExtensionUrl);
    await unzipPkgDir(utils.tmpDir, utils.tmpDir, 'binary');
    let certAddfileArr = fs.readdirSync(utils.tmpDir);
    let certAddFileName = 'cert-add-on_2.0.42_windows-64.zip';
    for (let fileName of certAddfileArr) {
        if (fileName.indexOf(platform) > 0) {
            certAddFileName = fileName;
        } else {
            fs.unlinkSync(path.resolve(utils.tmpDir, fileName));
        }
    }

    await unzipPkgDir(utils.tmpDir, utils.tmpDir, 'data/tools/certificate-manager/plugins');
    await unzipPkgDir(utils.tmpDir, utils.toolsDir + path.sep + 'SamsungCertificate', 'res/ca');
}

module.exports = {
    getPackageInfo,
    getExtensionPkgInfo,
    downloadPkg,
    downloadPkgFormPath,
    unzipPkgDir,
    unzipPkg,
    downloadSamsungCertfile
}
