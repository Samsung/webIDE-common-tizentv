const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const request = require('request');
const decompress = require('decompress');

const extensionRoot = path.resolve(__dirname, '..');
const toolsDir = path.resolve(extensionRoot, 'tools');
const tmpDir = path.resolve(extensionRoot, 'tmp');
const certZipFile = path.resolve(tmpDir, 'samsung-certificate.zip');
const platform = process.platform == 'win32' ? `windows` : process.platform == 'linux' ? `ubuntu` : 'macos';

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
		const pkgList = rootURL + `/pkg_list_${platform}`;

    return new Promise((resolve, reject) => {
        console.info('[webide-common-tizentv]getPackageInfo(): request to: ' + pkgList);
        let req = request(pkgList, (error, response, body) => {
            if (!response || response.statusCode != 200) {
                console.error('[webide-common-tizentv]getPackageInfo(): Failed to connect: ' + pkgList);
                reject(new Error(`Failed to archive tools infomation. Code:[${response.statusCode}]`));
            }
        });

				let pkgInfo = new PackageInfo(rootURL);
				let rl = readline.createInterface({input: req});
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

async function downloadPkg(packageInfo) {
    console.info('[webide-common-tizentv]downloadPkg(): downloadPkg start...');
		await downloadPkgFormPath(packageInfo.rootURL + packageInfo.path);
}

async function downloadPkgFormPath(packagePath) {
    console.info('[webide-common-tizentv]downloadPkg(): downloadPkgFormPath start...');

    //let tmpDir = path.resolve(extensionRoot, 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }

		let pkgName = 'temp.zip';
		let pathArr = packagePath.split('/');
		pkgName = pathArr[pathArr.length - 1];

    if (packagePath != '') {
        console.log('[webide-common-tizentv]Downloading from ' + packagePath + ' to ' + tmpDir + path.sep + pkgName);
        //await download(packagePath, tmpDir);
				request(packagePath).on('response', (response)=> {
						if (!response || response.statusCode != 200) {
                console.error('[webide-common-tizentv]downloadPkg(): response.statusCode: ' + response.statusCode);
								return;
            }
				}).pipe(fs.createWriteStream(tmpDir + path.sep + pkgName)).on('close', async () => {
						console.info('[webide-common-tizentv]downloadPkg(): download package file successful');
				    await unzipPkg(tmpDir, extensionRoot, 'data');
				});
    }
}

async function unzipPkg(zipFileDir, unzipDir, filterStr) {
    console.info('[webide-common-tizentv]unzipPkg(): unzipPkg start...');
    //let downloadTmpDir = path.resolve(extensionRoot,'tmp');
    if (!fs.existsSync(zipFileDir)) {
        console.log(`No files to unzip.`);
        return;
    }
    let dirent = fs.readdirSync(zipFileDir, {encoding: 'utf8', withFileTypes: false});
    if (dirent.length == 0) {
        console.log(`No files to unzip.`);
        return;
    }

    for(let zipFile of dirent) {
        await decompress(path.resolve(zipFileDir, zipFile), unzipDir, {
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
        console.log(`[webide-common-tizentv]unzip tool ${zipFile} finish.`);
    }

    dirent.forEach(zipFile => {
        fs.unlinkSync(path.resolve(zipFileDir, zipFile));
    });

    //fs.rmdirSync(zipFileDir);
}

async function downloadSamsungCertfile() {
    console.info('[webide-common-tizentv]downloadSamsungCertfile start');
	  let certGenFoler = 'https://developer.samsung.com/sdk-manager/repository/tizen-certificate-extension_2.0.42.zip';
	  if (!fs.existsSync(tmpDir)) {
		    console.info('[webide-common-tizentv]create dir:' + tmpDir);
		    fs.mkdirSync(tmpDir);
	  }

	  let streamFile = fs.createWriteStream(certZipFile);
	  console.info('[webide-common-tizentv]requet to download ' + certGenFoler);
	  await request(certGenFoler).pipe(streamFile).on('close',async () => {
		    console.info('[webide-common-tizentv]downloadSamsungCertfile(): download certificate file successful');
		    //unzipSamsungCertifile();
        await unzipPkg(tmpDir, tmpDir, 'binary');

        let certAddfileArr = fs.readdirSync(tmpDir);
        let certAddFileName = 'cert-add-on_2.0.42_windows-64.zip';
    		for (let fileName of certAddfileArr) {
            if (fileName.indexOf(platform) > 0) {
                certAddFileName = fileName;
            } else {
                fs.unlinkSync(path.resolve(tmpDir, fileName));
            }
    		}
        await unzipPkg(tmpDir, tmpDir, 'data/tools/certificate-manager/plugins');
        await unzipPkg(tmpDir, toolsDir + path.sep + 'SamsungCertificate', 'res/ca');
	  });
}

module.exports = {
    getPackageInfo,
    downloadPkg,
		downloadSamsungCertfile
}
