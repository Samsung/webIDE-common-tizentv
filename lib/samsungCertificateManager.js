var fs = require('fs');
var path = require('path');
var forge = require('node-forge');
var https = require('https');
var FormData = require('form-data');
var utils = require('./utils');
//var p12ToPem = require('./p12ToPem');
const Q = require('q');
//var ProfilesHandler = require('./profilesHandler');
var crypto = require('crypto');

const crtServerInfo = {
    host: 'dev.tizen.samsung.com',
    port: '443',
    path: '/apis/v2/authors'
};

const fetchServerInfo = {
    host: 'dev.tizen.samsung.com',
    port: '443',
    xmlPath: '/apis/v1/distributors',
    crtPath: '/apis/v2/distributors'
};

module.exports = class SamsungCM {
    constructor(resourcePath, samsungAuthorCaPath, samsungPublicCaPath, samsungPartnerCaPath) {
        this.resourcePath = resourcePath;
        this.rootFilePath = resourcePath + path.sep + 'SamsungCertificate';
        this.extensionPath = path.resolve(this.resourcePath, '..');
        this.caCertPath = samsungAuthorCaPath;
        this.publicCaPath = samsungPublicCaPath;
        this.partnerCaPath = samsungPartnerCaPath;
        this.authorFilePath = this.rootFilePath;
        this.distributorFilePath = this.rootFilePath;
        //this.profilePath = resourcePath + '/profiles.xml'.split('/').join(path.sep);
        this.privilegeLevel;
        this.accessInfo;
    }

    ceateAuthorCert(profileName, authorName, password, country, state, city, organization, department, accessInfo) {
        console.info('[webide-common-tizentv]SamsungCM.ceateAuthorCert(): start...');
        let deferred = Q.defer();
        this.authorFilePath = this.rootFilePath + path.sep + profileName;
        this.generateAuthorCSR(authorName, country, state, city, organization, department);
        this.fetchAuthorCRT(accessInfo).then((message) => {
            if (message == 'success') {
                this.generateAuthorPCKS12(password);
            }
            else {
                console.info('[webide-common-tizentv]SamsungCM.ceateAuthorCert(): fetchCRT failed.');
            }
            deferred.resolve(message);
        });

        return deferred.promise;
    }

    ceateDistributorCert(profileName, password, privilegeLevel, duidlist, accessInfo) {
        console.info('[webide-common-tizentv]SamsungCM.ceateDistributorCert(): start...');
        this.distributorFilePath = this.rootFilePath + path.sep + profileName;
        this.privilegeLevel = privilegeLevel;
        this.accessInfo = accessInfo;

        let deferred = Q.defer();
        this.generateDistributorCSR(duidlist, accessInfo);
        this.fetchDistributorCRT('fetch_xml').then(this.fetchDistributorCRT.bind(this)).then((message) => {
            this.generateDistributorPCKS12(password, privilegeLevel);
            deferred.resolve('success');
        }).catch((message) => {
            console.info('[webide-common-tizentv]SamsungCM.ceateDistributorCert(): fetchCRT failed. message:' + message);
            deferred.resolve(message);
        });

        return deferred.promise;
    }

    generateAuthorCSR(authorName, country, state, city, organization, department) {
        console.info('[webide-common-tizentv]SamsungCM.generateAuthorCSR(): start...');
        // make file path
        utils.makeFilePath(this.authorFilePath);

        // generate key pair
        var keys = forge.pki.rsa.generateKeyPair(2048);

        // generate csr file
        var csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        csr.setSubject([{
            name: 'commonName',
            value: authorName
        }, {
            shortName: 'OU',
            value: department
        }, {
            name: 'organizationName',
            value: organization
        }, {
            name: 'localityName',
            value: city
        }, {
            shortName: 'ST',
            value: state
        }, {
            name: 'countryName',
            value: country
        }]);

        // generate .pri file to keep private key
        //var salt = forge.random.getBytesSync(128);
        //var derivedKey = forge.pkcs5.pbkdf2(this.password, salt, 20, 16);
        let privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
        fs.writeFileSync(this.authorFilePath + path.sep + 'author.pri', privateKeyPem);

        // generate .csr file
        csr.sign(keys.privateKey);
        var pem = forge.pki.certificationRequestToPem(csr);
        fs.writeFileSync(this.authorFilePath + path.sep + 'author.csr', pem);
    }

    generateDistributorCSR(duidlist, accessInfo) {
        console.info('[webide-common-tizentv]SamsungCM.generateDistributorCSR(): start...');
        // make file path
        utils.makeFilePath(this.distributorFilePath);
        // generate key pair
        var keys = forge.pki.rsa.generateKeyPair(2048);
        // generate csr file
        var csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        csr.setSubject([{
            name: 'commonName',
            value: 'TizenSDK'
        }, {
            name: 'emailAddress',
            value: accessInfo.userEmail
        }]);

        let subjectAltNames = new Array();
        subjectAltNames.push({type:6, value: 'URN:tizen:packageid='});

        if (duidlist.length > 0) {
            duidlist.forEach((duid) => {
                subjectAltNames.push({type:6, value: 'URN:tizen:deviceid='+duid});
            });
        }

        csr.setAttributes([{
            name: 'extensionRequest',
            extensions: [{
                name: 'subjectAltName',
                altNames: subjectAltNames
            }]
        }]);

        // generate .pri file to keep private key
        let privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
        fs.writeFileSync(this.distributorFilePath + path.sep + 'distributor.pri', privateKeyPem);

        // generate .csr file
        csr.sign(keys.privateKey);
        var pem = forge.pki.certificationRequestToPem(csr);
        fs.writeFileSync(this.distributorFilePath + path.sep + 'distributor.csr', pem);
    }

    fetchAuthorCRT(accessInfo) {
        console.info('[webide-common-tizentv]SamsungCM.fetchAuthorCRT(): start...');

        let deferred = Q.defer();
        // set form data
        let form = new FormData();
        form.append('access_token', accessInfo.accessToken);
        form.append('user_id', accessInfo.userId);
        form.append('platform', 'VD');
        form.append('csr', fs.createReadStream(this.authorFilePath + path.sep + 'author.csr', {encoding: 'utf-8'}));

        // config https options
        let httpsOpt = {
            host: crtServerInfo.host,
            port: crtServerInfo.port,
            path: crtServerInfo.path,
            method: 'POST',
            headers: form.getHeaders()
        };

        // post 'multipart/form-data' request
        let request = https.request(httpsOpt);
        form.pipe(request);
        request.on('response', (res) => {
            console.log('[webide-common-tizentv]SamsungCM.fetchAuthorCRT(): status code: ' + res.statusCode);
            console.log('[webide-common-tizentv]SamsungCM.fetchAuthorCRT(): status msg: ' + res.statusMessage);

            if (res.statusCode == '200') {
                res.on('data', (chunk) => {
                    console.log('[webide-common-tizentv]SamsungCM.fetchAuthorCRT(): get response success!');
                    fs.writeFileSync(this.authorFilePath + path.sep + 'author.crt', chunk);
                    deferred.resolve('success');
                });
            }
            else {
                res.on('error', (err) => {
                    console.log('[webide-common-tizentv]SamsungCM.fetchAuthorCRT(): get response error!' + err.message);
                    deferred.resolve(err.message);
                });
            }
        });

        return deferred.promise;
    }

    fetchDistributorCRT(isCrt) {
        console.info('[webide-common-tizentv]SamsungCM.fetchDistributorCRT(): start... isCrt = ' + isCrt);
        let deferred = Q.defer();

        // set form data
        let form = new FormData();
        form.append('access_token', this.accessInfo.accessToken);
        form.append('user_id', this.accessInfo.userId);
        form.append('privilege_level', this.privilegeLevel);
        form.append('developer_type', 'Individual');
        form.append('platform', 'VD');
        form.append('csr', fs.createReadStream(this.distributorFilePath + path.sep + 'distributor.csr', {encoding: 'utf-8'}));

        // config https options
        let httpsOpt = {
            host: fetchServerInfo.host,
            port: fetchServerInfo.port,
            path: '',
            method: 'POST',
            headers: form.getHeaders()
        };

        if (isCrt == 'fetch_crt') {
            httpsOpt.path = fetchServerInfo.crtPath;
        }
        else if (isCrt == 'fetch_xml') {
            httpsOpt.path = fetchServerInfo.xmlPath;
        }

        // post 'multipart/form-data' request
        let request = https.request(httpsOpt);
        form.pipe(request);
        request.on('response', (res) => {
            console.log('[webide-common-tizentv]SamsungCM.fetchDistributorCRT(): status code: ' + res.statusCode);
            console.log('[webide-common-tizentv]SamsungCM.fetchDistributorCRT(): status msg: ' + res.statusMessage);

            if (res.statusCode == '200') {
                res.on('data', (chunk) => {
                    //console.log(`BODY: ${chunk}`);
                    console.log('[webide-common-tizentv]SamsungCM.fetchDistributorCRT():get response success!');
                    if (isCrt == 'fetch_crt') {
                        fs.writeFileSync(this.distributorFilePath + path.sep + 'distributor.crt', chunk);
                        deferred.resolve('fetch_xml');
                    }
                    else if (isCrt == 'fetch_xml') {
                        fs.writeFileSync(this.distributorFilePath + path.sep + 'device-profile.xml', chunk);
                        deferred.resolve('fetch_crt');
                    }
                });
            }
            else {
                res.on('error', (err) => {
                    console.log('[webide-common-tizentv]SamsungCM.fetchDistributorCRT(): problem with request: ' + err.message);
                    deferred.reject(err.message);
                });
            }
        });

        return deferred.promise;
    }

    generateAuthorPCKS12(password) {
        let authorCert = this.loadCaCert(this.authorFilePath + path.sep + 'author.crt');
        let caCert = this.loadCaCert(this.caCertPath);
        let certArray = [authorCert, caCert];

        let privateKeyPem = fs.readFileSync(this.authorFilePath + path.sep + 'author.pri');
        let privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        let newPkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
            privateKey, certArray, password,
            {generateLocalKeyId: true, friendlyName: 'UserCertificate'});

        let newPkcs12Der = forge.asn1.toDer(newPkcs12Asn1).getBytes();
        fs.writeFileSync(this.authorFilePath + path.sep + 'author.p12', newPkcs12Der, {encoding: 'binary'});
    }

    generateDistributorPCKS12(password, privilegeLevel) {
        let DistributorCert = this.loadCaCert(this.distributorFilePath + path.sep + 'distributor.crt');
        let caCert;
        if (privilegeLevel == 'Public') {
            caCert = this.loadCaCert(this.publicCaPath);
        }
        else {
            caCert = this.loadCaCert(this.partnerCaPath);
        }

        let certArray = [DistributorCert, caCert];

        let privateKeyPem = fs.readFileSync(this.distributorFilePath + path.sep + 'distributor.pri');
        let privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        let newPkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
           privateKey, certArray, password,
           {generateLocalKeyId: true, friendlyName: 'UserCertificate'});

        let newPkcs12Der = forge.asn1.toDer(newPkcs12Asn1).getBytes();
        fs.writeFileSync(this.distributorFilePath + path.sep + 'distributor.p12', newPkcs12Der, {encoding: 'binary'});
    }

    loadCaCert(certFile) {
        let certContent = '';

        if (path.extname(certFile) == '.ca') {
            let key = 'SRCNSDKTEAM2019';
            key = crypto.createHash('sha256').update(key).digest('base64').substr(0, 32);

            let inputData = fs.readFileSync(certFile);
            const iv = Buffer.alloc(16, 0);
            let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

            certContent = Buffer.concat([decipher.update(inputData,'hex'), decipher.final()]);
        }
        else {
            certContent = fs.readFileSync(certFile);
        }

        let caContent = certContent.toString('utf8');

        let strBeginCertificate = '-----BEGIN CERTIFICATE-----';
        let strEndCertificate = '-----END CERTIFICATE-----';

        let line1Beg  = caContent.indexOf(strBeginCertificate);
        let line1End  = caContent.indexOf(strEndCertificate);

        let strEndLen = strEndCertificate.length;

        var cert1 = caContent.substring(line1Beg, line1End+strEndLen);
        return cert1;
    }
}
