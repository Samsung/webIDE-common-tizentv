const profileEditor = require('./profileEditor');
const path = require('path');
const cryptUtil = require('./cryptUtil');
const fs = require('fs');

module.exports = class ProfileManager {
    constructor(resourcePath) {
        this.resourcePath = resourcePath;
        this.extensionPath = path.resolve(resourcePath, '..');
        this.profilePath = resourcePath + '/profiles.xml'.split('/').join(path.sep);
    }

    /*
    authorProfile{
        authorCA: '',
        authorCertPath: '',
        authorPassword: ''
    }
    distributorProfile{
        distributorCA: '',
        distributorCertPath: '',
        distributorPassword: ''
    }
    */
    async registerProfile(profileName, authorProfile, distributorProfile) {
        console.info('[webide-common-tizentv]ProfileCM.registerProfile(): profileName = ' + profileName);
        let authorPwdFile = '';
        let distributorPwdFile = '';
        if (authorProfile.authorPassword != '') {
            authorPwdFile = path.resolve(path.dirname(authorProfile.authorCertPath), path.basename(authorProfile.authorCertPath, '.p12') + '.pwd');
            await cryptUtil.encryptPassword(authorProfile.authorPassword, authorPwdFile);
        }

        if (distributorProfile.distributorPassword != '') {
            distributorPwdFile = path.resolve(path.dirname(distributorProfile.distributorCertPath), path.basename(distributorProfile.distributorCertPath, '.p12') + '.pwd');
            if (!fs.existsSync(distributorPwdFile)) {
                await cryptUtil.encryptPassword(distributorProfile.distributorPassword, distributorPwdFile);
            }
        }

        profileEditor.createProfile(this.profilePath, profileName, {
            ca: authorProfile.authorCA,
            key: authorProfile.authorCertPath,
            password: authorPwdFile
        }, {
            ca: distributorProfile.distributorCA,
            key: distributorProfile.distributorCertPath,
            password: distributorPwdFile
        }, undefined, false);
    }

    setActivateProfile(profileName) {
        console.info('[webide-common-tizentv]ProfileCM.setActivateProfile(): profileName = ' + profileName);
        return profileEditor.activateProfile(this.profilePath, profileName);
    }

    removeProfile(profileName) {
        console.info('[webide-common-tizentv]ProfileCM.removeProfile(): profileName = ' + profileName);
        let activeProfileName = profileEditor.getActiveProfile(this.profilePath);
        if (activeProfileName == profileName) {
            profileEditor.setEmptyActivateProfile(this.profilePath);
        }

        return profileEditor.removeProfile(this.profilePath, profileName);
    }

    async modifyProfile(profileName, itemType, certpath, password) {
        console.info('[webide-common-tizentv]ProfileCM.modifyProfile(): profileName = ' + profileName + ',itemType = ' + itemType);
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
                await cryptUtil.encryptPassword(password, passwordFile);
            }

            profile.profileitem[itemIndex].$.key = certpath;
            profile.profileitem[itemIndex].$.password = passwordFile;
        }

        return profileEditor.modifyProfile(this.profilePath, profileName, itemType, profile.profileitem[itemIndex]);
    }

    isProfileExist(profileName) {
        console.info('[webide-common-tizentv]ProfileCM.isProfileExist(): profileName = ' + profileName);
        return profileEditor.isProfileExist(this.profilePath, profileName);
    }

    listProfile() {
        console.info('[webide-common-tizentv]ProfileCM.listProfile() start...');
        return profileEditor.listProfile(this.profilePath);
    }

    getProfileKeys(profileName) {
        console.info('[webide-common-tizentv]ProfileCM.getProfileKeys(): profileName = ' + profileName);
        return profileEditor.getProfileKeys(this.profilePath, profileName);
    }

    getProfileItems(profileName) {
        console.info('[webide-common-tizentv]ProfileCM.getProfileItems(): profileName = ' + profileName);
        return profileEditor.getProfileItems(this.profilePath, profileName);
    }
}
