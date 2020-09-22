const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const request = require('request');
const crypto = require('crypto');
const cryptUtil = require('./cryptUtil');
const profileEditor = require('./profileEditor');
const utils = require('./utils');
const tools = require('@tizentv/tools');

module.exports = class TizenCertManager {
    constructor(resourcePath) {
        this.resourcePath = resourcePath;
        this.certPath = path.resolve(resourcePath, 'cert');
        this.authorPath = path.resolve(resourcePath, 'Author');
    }

    async init() {
        console.info('[webide-common-tizentv]constructor():init start...');
        let tizenCertPath = await tools.getTizenCertPath();
        this.caPriKeyPath = path.resolve(tizenCertPath, 'certificates', 'developer', 'tizen-developer-ca-privatekey.pem');
        this.caCertPath = path.resolve(tizenCertPath, 'certificates', 'developer', 'tizen-developer-ca.cer');
        this.distributorPublicCA = path.resolve(tizenCertPath, 'certificates', 'distributor', 'sdk-public', 'tizen-distributor-ca.cer');
        this.distributorPublicSigner = path.resolve(tizenCertPath, 'certificates', 'distributor', 'sdk-public', 'tizen-distributor-signer.p12');
        this.distributorPartnerCA = path.resolve(tizenCertPath, 'certificates', 'distributor', 'sdk-partner', 'tizen-distributor-ca.cer');
        this.distributorPartnerSigner = path.resolve(tizenCertPath, 'certificates', 'distributor', 'sdk-partner', 'tizen-distributor-signer.p12');
        this.distributorPassword = 'tizenpkcs12passfordsigner';
    }

    loadCaCert() {
        let caContent = fs.readFileSync(this.caCertPath, {encoding: 'utf8'});

        let strBeginCertificate = '-----BEGIN CERTIFICATE-----';
        let strEndCertificate = '-----END CERTIFICATE-----';

        let line1Beg  = caContent.indexOf(strBeginCertificate);
        let line1End  = caContent.indexOf(strEndCertificate);

        let strBeginLen = strBeginCertificate.length;
        let strEndLen = strEndCertificate.length;

        let cert1 = caContent.substring(line1Beg, line1End+strEndLen);
        return cert1;
    }

    /*
    authorInfo {
        keyFileName: '',
        authorName: '',
        authorPassword: '',
        countryInfo: '',
        stateInfo: '',
        cityInfo: '',
        organizationInfo: '',
        departmentInfo: '',
        emailInfo: ''
    }
    */
    createCert(authorInfo) {
        console.info('[webide-common-tizentv]TizenCertManager.createCert(): start...');
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
                value: authorInfo.countryInfo
            }, {
                shortName: 'ST',
                value: authorInfo.stateInfo
            }, {
                name: 'localityName',
                value: authorInfo.cityInfo
            }, {
                name: 'organizationName',
                value: authorInfo.organizationInfo
            }, {
                shortName: 'OU',
                value: authorInfo.departmentInfo
            }, {
                name: 'emailAddress',
                value: authorInfo.emailInfo
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

            let caPriPem = fs.readFileSync(this.caPriKeyPath, {encoding: 'utf8'});
            let caPassword = 'tizencertificatefordevelopercaroqkfwk';

            let decryptedCaPriKey = forge.pki.decryptRsaPrivateKey(caPriPem, caPassword);
            cert.sign(decryptedCaPriKey);
            console.info('[webide-common-tizentv]TizenCertManager.createCert() Certificate created.');

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

            let keyFilePath = this.authorPath + path.sep + authorInfo.keyFileName + '.p12';
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

    async getCertificateInfo(certPath, passwordFile) {
        console.info('[webide-common-tizentv]TizenCertManager.getCertificateInfo(): certPath = ' + certPath + ',' + passwordFile);
        let password = await cryptUtil.decryptPassword(passwordFile);
        let p12Content = cryptUtil.parseP12File(certPath, password);

        if(!p12Content){
            console.error('[webide-common-tizentv]TizenCertManager.getCertificateInfo(): p12 file is null');
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

    getTizenDeveloperCA() {
        console.info('[webide-common-tizentv]TizenCertManager.getTizenAuthorProfile():');
        return this.caCertPath;
    }

    getTizenDistributorProfile(privilegeLevel) {
        console.info('[webide-common-tizentv]TizenCertManager.getTizenDistributorProfile(): privilegeLevel = ' + privilegeLevel);
        let distributorCA = '';
        let distributorCertPath = '';
        if (privilegeLevel == 'partner') {
            distributorCA = this.distributorPartnerCA;
            distributorCertPath = this.distributorPartnerSigner;
        }
        else {
              distributorCA = this.distributorPublicCA;
              distributorCertPath = this.distributorPublicSigner;
        }

        return {
            distributorCA: distributorCA,
            distributorCertPath: distributorCertPath,
            distributorPassword: this.distributorPassword
        };
    }
}
