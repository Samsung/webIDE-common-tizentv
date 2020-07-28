const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const request = require('request');
//const compressing = require('compressing');
const crypto = require('crypto');
const cryptUtil = require('./cryptUtil');
const profileEditor = require('./profileEditor');
const utils = require('./utils');

module.exports = class TizenCM {
    constructor(resourcePath, developerCA, developerCAPriKeyPath) {
        this.resourcePath = resourcePath;
        this.extensionPath = path.resolve(resourcePath, '..');
        this.certPath = path.resolve(resourcePath, '..', 'resource', 'cert');
        this.authorPath = this.extensionPath + '/resource/Author'.split('/').join(path.sep);
        this.caPriKeyPath = developerCAPriKeyPath;
        this.caCertPath = developerCA;
    }
/*
    init() {
        console.info('[webide-common-tizentv]constructor():init start...');
        if (!fs.existsSync(this.caPriKeyPath) || !fs.existsSync(this.caCertPath)) {
            console.info('[webide-common-tizentv]constructor(): ' + this.caCertPath + ' is not exist');
            this.downloadTizenCertfile();
        }
    }

    downloadTizenCertfile() {
        console.info('[webide-common-tizentv]constructor():downloadTizenCertfile start...');
        let certGenFoler = 'https://download.tizen.org/sdk/tizenstudio/official/binary/';
        let certGenName = 'certificate-generator_0.1.2_windows-64.zip';
        if (process.platform == 'linux') {
            certGenName = 'certificate-generator_0.1.2_ubuntu-64.zip';
        } else if (process.platform == 'mac') {
            certGenName = 'certificate-generator_0.1.2_macos-64.zip';
        }

        let streamFile = fs.createWriteStream(this.certZipFile);
        console.info('[webide-common-tizentv]constructor():requet to download ' + certGenFoler + certGenName);
        request(certGenFoler + certGenName).pipe(streamFile).on('close', () => {
            console.info('[webide-common-tizentv]constructor():downloadTizenCertfile(): download certificate file successful');
            this.unzipTizenCertifile();
        });
    }

    unzipTizenCertifile() {
        console.info('[webide-common-tizentv]constructor():unzipTizenCertifile start...');
        compressing.zip.uncompress(this.certZipFile, this.certPath).then(() => {
            console.info('[webide-common-tizentv]constructor():unzip ' + this.certZipFile + ' successful');
        }).catch((err) => {
            console.error('[webide-common-tizentv]constructor():' + err);
        });
    }
*/
    loadCaCert() {
        //let key = 'SRCNSDKTEAM2019';
        //key = crypto.createHash('sha256').update(key).digest('base64').substr(0, 32);

        //let inputData = fs.readFileSync(this.caCertPath);
        //const iv = Buffer.alloc(16, 0);
        //let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        //let caCert = Buffer.concat([decipher.update(inputData,'hex'), decipher.final()]);

        let caCert = fs.readFileSync(this.caCertPath);
        let caContent = caCert.toString('utf8');

        let strBeginCertificate = '-----BEGIN CERTIFICATE-----';
        let strEndCertificate = '-----END CERTIFICATE-----';

        let line1Beg  = caContent.indexOf(strBeginCertificate);
        let line1End  = caContent.indexOf(strEndCertificate);

        let strBeginLen = strBeginCertificate.length;
        let strEndLen = strEndCertificate.length;

        let cert1 = caContent.substring(line1Beg, line1End+strEndLen);
        //console.log(cert1);
        return cert1;
    }

    createCert(keyfileName, authorName, authorPassword, countryInfo, stateInfo, cityInfo, organizationInfo, departmentInfo, emailInfo){
        console.info('[webide-common-tizentv]tizenCM.createCert(): start...');

        try {
            // generate a keypair
            let keys = forge.pki.rsa.generateKeyPair(1024);

            // create a certificate
            let cert = forge.pki.createCertificate();
            cert.publicKey = keys.publicKey;
            cert.serialNumber = '01';
            cert.validity.notBefore = new Date();

            let notAfterDate = new Date();
            notAfterDate.setFullYear(cert.validity.notBefore.getFullYear() + 8);
            cert.validity.notAfter = notAfterDate;

            let attrs = [{
                name: 'commonName',
                value: authorName
            },{
                name: 'countryName',
                value: countryInfo
            }, {
                shortName: 'ST',
                value: stateInfo
            }, {
                name: 'localityName',
                value: cityInfo
            }, {
                name: 'organizationName',
                value: organizationInfo
            }, {
                shortName: 'OU',
                value: departmentInfo
            }, {
                name: 'emailAddress',
                value: emailInfo
            }];

            let issurInfo = [{
                name: 'organizationName',
                value: 'Tizen Association'
            }, {
                shortName: 'OU',
                value: 'Tizen Association'
            }, {
                shortName: 'CN',
                value: 'Tizen Developers CA'
            }];
            cert.setSubject(attrs);
            cert.setIssuer(issurInfo);

            cert.setExtensions([{
                name: 'basicConstraints',
                cA: true
            }, {
                name: 'keyUsage',
                keyCertSign: true,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true
            }, {
                name: 'extKeyUsage',
                codeSigning: true
            }]);

            //read ca private Key
            //var caPriPem = fs.readFileSync(caPriKeyPath);
            //let key = 'SRCNSDKTEAM2019';
            //key = crypto.createHash('sha256').update(key).digest('base64').substr(0, 32);

            //let inputData = fs.readFileSync(this.caPriKeyPath);
            //const iv = Buffer.alloc(16, 0);
            //let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

            //let caPriPem = Buffer.concat([decipher.update(inputData,'hex'), decipher.final()]);
            let caPriPem = fs.readFileSync(this.caPriKeyPath);
            let caPassword = 'tizencertificatefordevelopercaroqkfwk';

            let decryptedCaPriKey = forge.pki.decryptRsaPrivateKey(caPriPem.toString('utf8'), caPassword);
            cert.sign(decryptedCaPriKey);
            console.info('[webide-common-tizentv]tizenCM.createCert() Certificate created.');

            //var userPriKey = forge.pki.privateKeyToPem(keys.privateKey);
            let userCert =  forge.pki.certificateToPem(cert);

            let caCert = this.loadCaCert();
            let certArray = [userCert, caCert];

            // create PKCS12
            let newPkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
                keys.privateKey, certArray, authorPassword,
                {generateLocalKeyId: true, friendlyName: authorName});

            let newPkcs12Der = forge.asn1.toDer(newPkcs12Asn1).getBytes();

            if (!fs.existsSync(this.authorPath)) {
                utils.makeFilePath(this.authorPath);
            }

            let keyFilePath = this.authorPath + path.sep + keyfileName + '.p12';
            fs.writeFileSync(keyFilePath, newPkcs12Der, {encoding: 'binary'});
        } catch(ex) {
            if(ex.stack) {
                console.error(ex.stack);
            } else {
                console.error('Error', ex);
            }
            throw ex;
        }
    }
/*
    registerProfile(profileName, authorCA, authorCertPath, authorPassword, distributorCA, distributorCertPath, distributorPassword) {
        console.info('[webide-common-tizentv]tizenCM.registerProfile(): profileName = ' + profileName);
        let authorPwdFile = path.resolve(path.dirname(authorCertPath), path.basename(authorCertPath, '.p12') + '.pwd');
        let distributorPwdFile = path.resolve(path.dirname(distributorCertPath), path.basename(distributorCertPath, '.p12') + '.pwd');

        cryptUtil.encryptPassword(authorPassword, authorPwdFile);
        if (!fs.existsSync(distributorPwdFile)) {
            cryptUtil.encryptPassword(distributorPassword, distributorPwdFile);
        }

        profileEditor.createProfile(this.profilePath, profileName, {
            ca: authorCA,
            key: authorCertPath,
            password: authorPwdFile
        }, {
            ca: distributorCA,
            key: distributorCertPath,
            password: distributorPwdFile
        }, undefined, false);
    }

    setActivateProfile(profileName) {
        console.info('[webide-common-tizentv]tizenCM.setActivateProfile(): profileName = ' + profileName);
        return profileEditor.activateProfile(this.profilePath, profileName);
    }

    removeProfile(profileName) {
        console.info('[webide-common-tizentv]tizenCM.removeProfile(): profileName = ' + profileName);
        let activeProfileName = profileEditor.getActiveProfile(this.profilePath);
        if (activeProfileName == profileName) {
            profileEditor.setEmptyActivateProfile(this.profilePath);
        }

        return profileEditor.removeProfile(this.profilePath, profileName);
    }

    modifyProfile(profileName, itemType, certpath, password) {
        console.info('[webide-common-tizentv]tizenCM.modifyProfile(): profileName = ' + profileName + ',itemType = ' + itemType);
        let itemIndex = itemType == 'author' ? 0 : (itemType == 'distributor1' ? 1 : 2);
        let profile = profileEditor.getProfile(this.profilePath, profileName);
        if (profile == undefined) {
            return;
        }
        if ('' == certpath) {
            profile.profileitem[itemIndex].$.ca = '';
            profile.profileitem[itemIndex].$.key = '';
            profile.profileitem[itemIndex].$.password = '';
            profile.profileitem[itemIndex].$.rootca = '';
        } else {
            let passwordFile = path.resolve(path.dirname(certpath), path.basename(certpath, '.p12') + '.pwd');
            if (!fs.existsSync(passwordFile)) {
                cryptUtil.encryptPassword(password, passwordFile);
            }

            profile.profileitem[itemIndex].$.key = certpath;
            profile.profileitem[itemIndex].$.password = passwordFile;
        }

        return profileEditor.modifyProfile(this.profilePath, profileName, itemType, profile.profileitem[itemIndex]);
    }

    removeDistributorCert(profileName, itemType) {
        console.info('[webide-common-tizentv]tizenCM.removeDistributorCert(): profileName = ' + profileName + ',itemType = ' + itemType);
        return this.modifyProfile(profileName, itemType, '', '');
    }
*/
    getCertificateInfo(certPath, passwordFile) {
        console.info('[webide-common-tizentv]tizenCM.getCertificateInfo(): certPath = ' + certPath + ',' + passwordFile);
        let password = cryptUtil.decryptPassword(passwordFile);
        let p12Content = cryptUtil.parseP12File(certPath, password);

        if(!p12Content){
            console.error('[webide-common-tizentv]tizenCM.getCertificateInfo(): p12 file is null');
            return;
        }

        let afterYear = '';
        let issuerName = '';
        let certBegin = '-----BEGIN CERTIFICATE-----';
        let certEnd = '-----END CERTIFICATE-----';
        let certChain = p12Content.certChain;
        let certs = certChain.slice(0);
        let cert = certs.shift();
        let certPem = certBegin + cert + certEnd;
        let parsecert = forge.pki.certificateFromPem(certPem);
        let afterDate = parsecert.validity.notAfter;
        afterYear = afterDate.toString();
        afterYear = afterYear.substring(3,15);

        for(var j = 0 ; j<parsecert.issuer.attributes.length;j++){
            let name = parsecert.issuer.attributes[j].name;
            let value = parsecert.issuer.attributes[j].value;
            if(name == 'commonName'){
                issuerName = value;
                break;
            }
        }

        return{afterYear, issuerName};
    }
}
