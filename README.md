# @tizentv/webIDE-common-tizentv
`@tizentv/webIDE-common-tizentv` package is a common lib project for VScode/Atom extension and Wits, providing build, install, launch web project and certificate manager.

Please note that, In order to use this pacakge, `@types/webIDE-common-tizentv` is required.

## Supported APIs
-   TVWebApp

```js
    constructor(name, location, id);
    init();
    buildWidget(profilePath, excludeFiles);
    launchOnSimulator(simulatorLocation);
    launchOnEmulator(chromeExecPath, isDebug);
    launchOnTV(tvIP, chromeExecPath, isDebug);
    openProject(projectPath);
```

-   TizenCM

```js
    constructor(resourcePath, developerCA, developerCAPriKeyPath);
    createCert(keyfileName, authorName, authorPassword, countryInfo, stateInfo, cityInfo, organizationInfo, departmentInfo, emailInfo);
```

-   SamsungCM

```js
    constructor(resourcePath, samsungAuthorCaPath, samsungPublicCaPath, samsungPartnerCaPath);
    ceateAuthorCert(profileName, authorName, password, country, state, city, organization, department, accessInfo);
    ceateDistributorCert(profileName, password, privilegeLevel, duidlist, accessInfo);
```

-   ProfileManager

```js
    constructor(resourcePath);
    registerProfile(profileName, authorCA, authorCertPath, authorPassword, distributorCA, distributorCertPath, distributorPassword);
    setActivateProfile(profileName);
    removeProfile(profileName);
    modifyProfile(profileName, itemType, certpath, password);
    isProfileExist(profileName);
    listProfile();
    getProfileKeys(profileName);
    getProfileItems(profileName);
```
