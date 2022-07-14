const platform = require('os').platform();
const fs = require('fs');
const { exec } = require('child_process');
const forge = require('node-forge');
const tools = require('@tizentv/tools');
const chalk = require('chalk');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function encryptPassword(password, pwdFile) {
  if (platform == 'win32') {
    let cryptTool = await tools.getEncryptorPath();
    console.info('cryptTool = ' + cryptTool);
    try {
      await execAsync(`${cryptTool} --encrypt "${password}" ${pwdFile}`);
    } catch (err) {
      if (err.stderr && err.stderr.toString()) {
        console.log(err.stderr.toString());
      }
    }
  } else if (platform == 'linux') {
    let cryptTool = await tools.getEncryptorPath();
    console.info('cryptTool = ' + cryptTool);
    try {
      fs.accessSync(cryptTool, fs.constants.S_IXUSR);
    } catch (err) {
      fs.chmodSync(cryptTool, fs.constants.S_IRWXU | fs.constants.S_IRWXG);
    }
    try {
      await execAsync(
        `${cryptTool} store --label="tizen-studio" -p "${password}" keyfile ${pwdFile} tool certificate-manager`
      );
    } catch (e) {
      console.info(
        chalk.red('Failed to store password. Please check your Linux system')
      );
      console.info(
        chalk.red(
          'As the Tizen Certificate constraint, it is not supported in headless Linux system.\n'
        )
      );
      throw e;
    }
  } else if (platform == 'darwin') {
    await execAsync(
      `security add-generic-password -a ${pwdFile} -s certificate-manager -w "${password}" -U`
    );
  }
}

async function decryptPassword(pwdFile) {
  let password = '';
  if (platform == 'win32') {
    let cryptTool = await tools.getEncryptorPath();
    console.info('cryptTool = ' + cryptTool);
    try {
      const { stdout } = await execAsync(`${cryptTool} --decrypt ${pwdFile}`);
      let out = stdout;
      out = out.toString();
      if (out.includes('PASSWORD:')) {
        out.trim();
        password = out.substring(9).replace(/[\r\n]/g, '');
      }
    } catch (err) {
      const stdout = err.stdout;
      if (stdout && stdout.includes('PASSWORD:')) {
        stdout.trim();
        password = stdout.substring(9).replace(/[\r\n]/g, '');
      } else {
        console.info(err);
      }
    }
  } else if (platform == 'linux') {
    let cryptTool = await tools.getEncryptorPath();
    console.info('cryptTool = ' + cryptTool);
    const { stdout, stderr } = await execAsync(
      `${cryptTool} lookup --label="tizen-studio" keyfile ${pwdFile} tool certificate-manager`
    );
    let out = stdout;
    out = out.toString();
    if (out) {
      out.trim();
      password = out.replace(/[\r\n]/g, '');
    }

    if (stderr || password.match(/ERROR \d+.+lookup+.+failed/)) {
      console.info(password);
      throw new Error(
        'Failed to get password. Please check your Linux system \nAs the Tizen Certificate constraint, it is not supported in headless Linux system.'
      );
    }
  } else if (platform == 'darwin') {
    const { stdout, stderr } = await execAsync(
      `security find-generic-password -wa ${pwdFile} -s certificate-manager`
    );
    let out = stdout;
    out = out.toString();
    if (out) {
      out.trim();
      password = out.replace(/[\r\n]/g, '');
    }
  }

  return password;
}

function checkP12Password(file, password) {
  try {
    let p12Der = fs.readFileSync(file).toString('binary');
    let p12Asn1 = forge.asn1.fromDer(p12Der);
    forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch (err) {
    console.log(err.message);
    return false;
  }

  return true;
}

function parseP12File(p12File, password) {
  let p12Content = {
    privateKey: '',
    certChain: []
  };
  try {
    let p12Der = fs.readFileSync(p12File).toString('binary');
    let p12Asn1 = forge.asn1.fromDer(p12Der);
    let p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    p12.safeContents.forEach(safeContent => {
      safeContent.safeBags.forEach(safeBag => {
        if (safeBag.type == forge.pki.oids.certBag) {
          let certBegin = '-----BEGIN CERTIFICATE-----';
          let certEnd = '-----END CERTIFICATE-----';
          let cert = forge.pki.certificateToPem(safeBag.cert);
          let from = cert.indexOf(certBegin) + certBegin.length + 1;
          let to = cert.indexOf(certEnd);
          p12Content.certChain.push(cert.substring(from, to));
        } else if (safeBag.type == forge.pki.oids.pkcs8ShroudedKeyBag) {
          let keyBegin = '-----BEGIN RSA PRIVATE KEY-----';
          let key = forge.pki.privateKeyToPem(safeBag.key);
          let from = key.indexOf(keyBegin);
          p12Content.privateKey = key.substring(from);
        }
      });
    });
  } catch (err) {
    console.log(err.message);
    throw err;
  }

  return p12Content;
}

module.exports = {
  encryptPassword,
  decryptPassword,
  checkP12Password,
  parseP12File
};
