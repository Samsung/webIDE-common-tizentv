# @tizentv/webIDE-common-tizentv
`@tizentv/webIDE-common-tizentv` package is a common lib project for VScode/Atom extension and Wits, providing build, install, launch web project and certificate manager.

Please note that, In order to use this pacakge, `@tizentv/webIDE-common-tizentv` is required.

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
    constructor(resourcePath) ;
    init();
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
    createCert(authorInfo);
    getTizenDeveloperCA();
    /*
    * privilegeLevel: 'public'/'partner'
    */
    getTizenDistributorProfile(privilegeLevel);

    usage:
        let tizenCertMgr = new TizenCM('D:\resource');
        await tizenCertMgr.init();
        tizenCertMgr.createCert(certInfo.authorInfo.info);
```

-   SamsungCM

```js
    constructor(resourcePath);

    /*
    authorInfo  {
        name : '',
        password : '',
        country : '',
        state : '',
        city : '',
        organization : '',
        department : ''
    */
    createAuthorCert(profileName, authorInfo, accessInfo);

    /*
        distrbutorInfo {
            distributorPassword : '',
            privilegeLevel : '',
            duidList : ['', '', ...]
    */
    createDistributorCert(profileName, distrbutorInfo, accessInfo);
```

-   ProfileManager

```js
    constructor(resourcePath);

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
    registerProfile(profileName, authorProfile, distributorProfile);
    setActivateProfile(profileName);
    removeProfile(profileName);
    modifyProfile(profileName, itemType, certpath, password);
    isProfileExist(profileName);
    listProfile();
    getProfileKeys(profileName);
    getProfileItems(profileName);

    usage:
        let profileMgr = new ProfileManager(common.resourcePath);
        tizenAuthorProfile = {
            authorCA: tizenCertMgr.getTizenDeveloperCA(),
            authorCertPath: authorCertPath,
            authorPassword: authorPassword
        };
        tizenDistributorProfile = tizenCertMgr.getTizenDistributorProfile('public');
        profileMgr.registerProfile('name', tizenAuthorProfile, tizenDistributorProfile);
```
