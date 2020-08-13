const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const request = require('request');
const crypto = require('crypto');
const cryptUtil = require('./cryptUtil');
const profileEditor = require('./profileEditor');
const utils = require('./utils');
const downloadMgr = require('./downloadManager');

const tizenDownloadUrl = 'http://download.tizen.org/sdk/tizenstudio/official';
const extensionRoot = path.resolve(__dirname, '..');

const caPriKeyPath = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'developer', 'tizen-developer-ca-privatekey.pem');
const caCertPath = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'developer', 'tizen-developer-ca.cer');

const distributorPublicCA = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'distributor', 'sdk-public', 'tizen-distributor-ca.cer');
const distributorPublicSigner = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'distributor', 'sdk-public', 'tizen-distributor-signer.p12');
const distributorPartnerCA = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'distributor', 'sdk-partner', 'tizen-distributor-ca.cer');
const distributorPartnerSigner = path.resolve(extensionRoot, 'tools', 'certificate-generator', 'certificates', 'distributor', 'sdk-partner', 'tizen-distributor-signer.p12');
const distributorPassword = 'tizenpkcs12passfordsigner';

module.exports = class TizenCM {
    constructor(resourcePath) {
        this.resourcePath = resourcePath;
        this.certPath = path.resolve(resourcePath, 'cert');
        this.authorPath = path.resolve(resourcePath, 'Author');

        this.init();
    }

    async init() {
        console.info('[webide-common-tizentv]constructor():init start...');
        if (!fs.existsSync(caPriKeyPath) || !fs.existsSync(caCertPath)) {
            console.info('[webide-common-tizentv]constructor(): ' + caCertPath + ' is not exist');
            let pkgInfo = await downloadMgr.getPackageInfo(tizenDownloadUrl, 'certificate-generator');
            console.info(pkgInfo);
            downloadMgr.downloadPkg(pkgInfo);
        }
    }

    loadCaCert() {
        let caCert = fs.readFileSync(caCertPath);
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

    /*
    authorInfo {
        authorFile: '',
        authorName: '',
        authorPassword: '',
        authorCountry: '',
        authorState: '',
        authorCity: '',
        authorOrganization: '',
        authorDepartment: '',
        authorEmail: ''
    }
    */
    createCert(authorInfo) {
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
                value: authorInfo.authorName
            },{
                name: 'countryName',
                value: authorInfo.authorCountry
            }, {
                shortName: 'ST',
                value: authorInfo.authorState
            }, {
                name: 'localityName',
                value: authorInfo.authorCity
            }, {
                name: 'organizationName',
                value: authorInfo.authorOrganization
            }, {
                shortName: 'OU',
                value: authorInfo.authorDepartment
            }, {
                name: 'emailAddress',
                value: authorInfo.authorEmail
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

            let caPriPem = fs.readFileSync(caPriKeyPath);
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
                keys.privateKey, certArray, authorInfo.authorPassword,
                {generateLocalKeyId: true, friendlyName: authorInfo.authorName});

            let newPkcs12Der = forge.asn1.toDer(newPkcs12Asn1).getBytes();

            if (!fs.existsSync(this.authorPath)) {
                utils.makeFilePath(this.authorPath);
            }

            let keyFilePath = this.authorPath + path.sep + authorInfo.authorFile + '.p12';
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

    static getTizenDeveloperCA() {
        console.info('[webide-common-tizentv]tizenCM.getTizenAuthorProfile():');
        return caCertPath;
    }

    static getTizenDistributorProfile(privilegeLevel) {
        console.info('[webide-common-tizentv]tizenCM.getTizenDistributorProfile(): privilegeLevel = ' + privilegeLevel);
				let distributorCA = '';
				let distributorCertPath = '';
        if (privilegeLevel == 'public') {
            distributorCA = distributorPublicCA;
            distributorCertPath = distributorPublicSigner;
        }
        else if (privilegeLevel == 'partner') {
            distributorCA = distributorPartnerCA;
            distributorCertPath = distributorPartnerSigner;
        }

        return {
            distributorCA: distributorCA,
            distributorCertPath: distributorCertPath,
            distributorPassword: distributorPassword
        };
    }
}
